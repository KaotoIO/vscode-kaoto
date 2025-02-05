/**
 * Copyright 2024 Red Hat, Inc. and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { backendI18nDefaults, backendI18nDictionaries } from "@kie-tools-core/backend/dist/i18n";
import { VsCodeBackendProxy } from "@kie-tools-core/backend/dist/vscode";
import { EditorEnvelopeLocator, EnvelopeContentType, EnvelopeMapping } from "@kie-tools-core/editor/dist/api";
import { I18n } from "@kie-tools-core/i18n/dist/core";
import * as KogitoVsCode from "@kie-tools-core/vscode-extension/dist";
import { getRedHatService, TelemetryEvent, TelemetryService } from "@redhat-developer/vscode-redhat-telemetry";
import * as vscode from "vscode";
import { KAOTO_FILE_PATH_GLOB, isCamelPluginInstalled, verifyJBangIsInstalled } from "../helpers/helpers";
import { VSCodeKaotoChannelApiProducer } from './../webview/VSCodeKaotoChannelApiProducer';
import { NewCamelRouteCommand } from '../../src/commands/NewCamelRouteCommand';
import { NewCamelKameletCommand } from '../../src/commands/NewCamelKameletCommand';
import { NewCamelPipeCommand } from '../../src/commands/NewCamelPipeCommand';
import { NewCamelFileCommand } from '../../src/commands/NewCamelFileCommand';
import { NewCamelQuarkusProjectCommand } from "../../src/commands/NewCamelQuarkusProjectCommand";
import { NewCamelSpringBootProjectCommand } from "../../src/commands/NewCamelSpringBootProjectCommand";
import { NewCamelProjectCommand } from "../../src/commands/NewCamelProjectCommand";
import { CamelRunJBangTask } from "../../src/tasks/CamelRunJBangTask";
import { CamelKubernetesRunJBangTask } from "../../src/tasks/CamelKubernetesRunJBangTask";
import { CamelAddPluginJBangTask } from "../../src/tasks/CamelAddPluginJBangTask";
import { CamelStopJBangTask } from "../../src/tasks/CamelStopJBangTask";
import { CamelRouteOperationJBangTask } from "../../src/tasks/CamelRouteOperationJBangTask";
import { IntegrationsProvider, Integration } from "../views/IntegrationsProvider";
import { HelpFeedbackProvider } from "../../src/views/HelpFeedbackProvider";
import { OpenApiProvider } from "../../src/views/OpenApiProvider";
import { confirmFileDeleteDialog } from '../../src/helpers/modals';
import { ChildItem, DeploymentsProvider, ParentItem, Route } from "../views/DeploymentsProvider";
import * as pjson from '../../package.json';
import { DataMappingsProvider } from "../../src/views/DataMappingsProvider";
import { TestsProvider } from "../../src/views/TestsProvider";
import { RouteOperation } from "../helpers/CamelJBang";
import { CamelLogJBangTask } from "../../src/tasks/CamelLogJBangTask";
import { PortManager } from "../../src/helpers/PortManager";
import * as path from 'path';

let backendProxy: VsCodeBackendProxy;
let telemetryService: TelemetryService;

export const WORKSPACE_WARNING_MESSAGE = `The action requires an opened folder/workspace to complete successfully.`;

export const KAOTO_INTEGRATIONS_VIEW_REFRESH_COMMAND_ID = 'kaoto.integrations.refresh';
export const KAOTO_DEPLOYMENTS_VIEW_REFRESH_COMMAND_ID = 'kaoto.deployments.refresh';
export const KAOTO_OPENAPI_VIEW_REFRESH_COMMAND_ID = 'kaoto.openapi.refresh';
export const KAOTO_DATAMAPPINGS_VIEW_REFRESH_COMMAND_ID = 'kaoto.datamappings.refresh';
export const KAOTO_TESTS_VIEW_REFRESH_COMMAND_ID = 'kaoto.tests.refresh';

export async function activate(context: vscode.ExtensionContext) {
	console.info("Kaoto extension is alive."); // TODO switch "all" console logs into Kaoto output channel

	const redhatService = await getRedHatService(context);
	telemetryService = await redhatService.getTelemetryService();
	telemetryService.sendStartupEvent();

	const backendI18n = new I18n(backendI18nDefaults, backendI18nDictionaries, vscode.env.language);
	backendProxy = new VsCodeBackendProxy(context, backendI18n);

	const kieEditorStore = await KogitoVsCode.startExtension({
		extensionName: "redhat.vscode-kaoto",
		context: context,
		viewType: "webviewEditorsKaoto",
		editorEnvelopeLocator: new EditorEnvelopeLocator("vscode", [
			new EnvelopeMapping({
				type: "kaoto",
				filePathGlob: KAOTO_FILE_PATH_GLOB,
				resourcesPathPrefix: "dist/webview/editors/kaoto",
				envelopeContent: {
					type: EnvelopeContentType.PATH,
					path: "dist/webview/KaotoEditorEnvelopeApp.js"
				}
			}),
		]),
		backendProxy: backendProxy,
		channelApiProducer: new VSCodeKaotoChannelApiProducer(),
		editorDocumentType: "text" // TODO verify it will not break anything - this is needed for listeners to be able to update Kaoto view sections immediately, look closer on 'kieEditorStore.activeEditor?.startListeningToDocumentChanges()'
	});

	// TODO the extension.ts file needs to be refactored into separated files - views, commands, status bar, ...

	// create a new status bar item that we can now manage
	const kaotoStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	kaotoStatusBarItem.name = 'Kaoto UI';
	kaotoStatusBarItem.tooltip = 'Embedded Kaoto UI version';
	kaotoStatusBarItem.text = `$(verified) Kaoto ${pjson.dependencies["@kaoto/kaoto"]}`;
	context.subscriptions.push(kaotoStatusBarItem);
	context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((event) => {
		if (event.fileName.endsWith('.camel.yaml')) {
			kaotoStatusBarItem.show();
		}
	}));
	context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((event) => {
		if (event.fileName.endsWith('.camel.yaml')) {
			kaotoStatusBarItem.hide();
		}
	}));

	// create a Port Manager for Camel JBang Run with Dev console
	const portManager = new PortManager(10111, 10999); // TODO revisit port numbers range

	/*
	* register integrations view provider
	*/
	const integrationsProvider = new IntegrationsProvider();
	const integrationsTreeView = vscode.window.createTreeView('kaoto.integrations', {
		treeDataProvider: integrationsProvider,
		showCollapseAll: true
	});
	context.subscriptions.push(integrationsTreeView);
	context.subscriptions.push(vscode.commands.registerCommand(KAOTO_INTEGRATIONS_VIEW_REFRESH_COMMAND_ID, () => integrationsProvider.refresh()));

	context.subscriptions.push(vscode.commands.registerCommand('kaoto.integrations.editSource', async (integrationEntry: Integration) => {
		await vscode.window.showTextDocument(vscode.Uri.parse(integrationEntry.filepath));
	}));
	context.subscriptions.push(vscode.commands.registerCommand('kaoto.integrations.deleteEntry', async (integrationEntry: Integration) => {
		const confirmation = await confirmFileDeleteDialog(integrationEntry.description as string); // integrationEntry.description ==> at the moment points to File name
		if (confirmation) {
			await vscode.workspace.fs.delete(vscode.Uri.file(integrationEntry.filepath), { useTrash: true });
			integrationsProvider.refresh();
			await vscode.window.showInformationMessage(`File '${integrationEntry.description}' was moved to Trash.`);
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('kaoto.integrations.jbang.run', async function (integrationEntry: Integration) {
		if (!vscode.workspace.workspaceFolders) {
			await vscode.window.showWarningMessage(WORKSPACE_WARNING_MESSAGE);
			return;
		}
		await new CamelRunJBangTask(path.basename(integrationEntry.filepath), path.dirname(integrationEntry.filepath), portManager.allocatePort()).executeOnly();
		await new Promise((time) => setTimeout(time, 2_500)); // TODO remove static time, at the moment just to give some more time to ensure Camel JBang reflects properly new state
		deploymentsProvider.refresh();
		await sendCommandTrackingEvent('kaoto.integrations.jbang.run');
	}));
	context.subscriptions.push(vscode.commands.registerCommand('kaoto.integrations.jbang.run.all', async function () {
		if (!vscode.workspace.workspaceFolders) {
			await vscode.window.showWarningMessage(WORKSPACE_WARNING_MESSAGE);
			return;
		}
		await new CamelRunJBangTask('*', undefined, portManager.allocatePort()).executeOnly();
		await new Promise((time) => setTimeout(time, 2_500)); // TODO remove static time, at the moment just to give some more time to ensure Camel JBang reflects properly new state
		deploymentsProvider.refresh();
		await sendCommandTrackingEvent('kaoto.integrations.jbang.run.all');
	}));
	context.subscriptions.push(vscode.commands.registerCommand('kaoto.integrations.kubernetes.run', async function (integrationEntry: Integration) {
		if (!(await isCamelPluginInstalled('kubernetes'))) {
			await new CamelAddPluginJBangTask('kubernetes').execute();
		}
		await new CamelKubernetesRunJBangTask(path.basename(integrationEntry.filepath), path.dirname(integrationEntry.filepath)).executeOnly();
		await new Promise((time) => setTimeout(time, 2_500)); // TODO remove static time, at the moment just to give some more time to ensure Camel JBang reflects properly new state
		deploymentsProvider.refresh();
		await sendCommandTrackingEvent('kaoto.integrations.kubernetes.run');
	}));

	// Function to fetch Kubernetes data (mock or real implementation)
	const fetchKubernetesData = async (): Promise<Map<string, Route[]>> => {
		// TODO Replace with actual implementation for Kubernetes data fetching
		const mockData = new Map<string, Route[]>();
		return mockData;
	};

	/*
	 * register deployments view provider
	 */
	const deploymentsProvider = new DeploymentsProvider(fetchKubernetesData, portManager);
	context.subscriptions.push(vscode.commands.registerCommand(KAOTO_DEPLOYMENTS_VIEW_REFRESH_COMMAND_ID, () => deploymentsProvider.refresh()));
	context.subscriptions.push({
		// Dispose the provider on deactivation
		dispose: () => deploymentsProvider.dispose()
	});

	// Register the Tree Data Provider
	const deploymentsTreeView = vscode.window.createTreeView('kaoto.deployments', {
		treeDataProvider: deploymentsProvider,
		showCollapseAll: true
	});
	context.subscriptions.push(deploymentsTreeView);

	// Automatically refresh when the Tree View becomes visible
	context.subscriptions.push(deploymentsTreeView.onDidChangeVisibility((event) => {
		if (event.visible) {
			deploymentsProvider.refresh();
		} else {
			console.log('Pausing REFRESH interval');
			deploymentsProvider.dispose();
		}
	}));

	// allow change auto-refresh interval using setting
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration(DeploymentsProvider.SETTINGS_DEPLOYMENTS_REFRESH_INTERVAL_ID)) {
			const newInterval = vscode.workspace.getConfiguration().get(DeploymentsProvider.SETTINGS_DEPLOYMENTS_REFRESH_INTERVAL_ID) as number;
			deploymentsProvider.setAutoRefreshInterval(newInterval);
		}
	}));

	/*
	 * register openapi view provider
	 */
	const openApiProvider = new OpenApiProvider();
	context.subscriptions.push(vscode.window.registerTreeDataProvider('kaoto.openapi', openApiProvider));
	context.subscriptions.push(vscode.commands.registerCommand(KAOTO_OPENAPI_VIEW_REFRESH_COMMAND_ID, () => openApiProvider.refresh()));

	/*
	 * register help & feedback view provider
	 */
	context.subscriptions.push(vscode.window.registerTreeDataProvider('kaoto.help', new HelpFeedbackProvider()));

	// register command for open camel source code in side to side editor
	context.subscriptions.push(vscode.commands.registerCommand('kaoto.open.source', async () => {
		if (kieEditorStore.activeEditor !== undefined) {
			const doc = await vscode.workspace.openTextDocument(kieEditorStore.activeEditor?.document.document.uri);
			await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
		}
	}));

	/*
	* register data mappings provider
	*/
	const dataMappingsProvider = new DataMappingsProvider();
	context.subscriptions.push(vscode.window.registerTreeDataProvider('kaoto.datamappings', dataMappingsProvider));
	context.subscriptions.push(vscode.commands.registerCommand(KAOTO_DATAMAPPINGS_VIEW_REFRESH_COMMAND_ID, () => dataMappingsProvider.refresh()));

	/*
	* register tests provider
	*/
	const testsProvider = new TestsProvider();
	context.subscriptions.push(vscode.window.registerTreeDataProvider('kaoto.tests', testsProvider));
	context.subscriptions.push(vscode.commands.registerCommand(KAOTO_TESTS_VIEW_REFRESH_COMMAND_ID, () => testsProvider.refresh()));

	/*
	 * register listeners for Terminal state changes
	 */
	context.subscriptions.push(vscode.window.onDidChangeTerminalState(async () => {
		// TODO made actions for only Kaoto related files
		await new Promise((time) => setTimeout(time, 750)); // TODO remove static time, at the moment just to give some more time to ensure Camel JBang reflects properly new state
		deploymentsProvider.refresh();
	}));

	// register command for close camel source code in side to side editor
	context.subscriptions.push(vscode.commands.registerCommand('kaoto.close.source', async () => {
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
	}));

	// register command for open file with kaoto editor in webview
	context.subscriptions.push(vscode.commands.registerCommand('kaoto.open', async (uri: vscode.Uri) => {
		await vscode.commands.executeCommand('vscode.openWith', uri, 'webviewEditorsKaoto');
	}));

	// Register commands for new Camel Route files - YAML DSL, Java DSL
	context.subscriptions.push(vscode.commands.registerCommand(NewCamelFileCommand.ID_COMMAND_CAMEL_NEW_FILE, async (uri: vscode.Uri) => {
		await new NewCamelFileCommand().create(uri);
		await sendCommandTrackingEvent(NewCamelFileCommand.ID_COMMAND_CAMEL_NEW_FILE);
	}));
	context.subscriptions.push(vscode.commands.registerCommand(NewCamelRouteCommand.ID_COMMAND_CAMEL_ROUTE_JBANG_YAML, async (uri: vscode.Uri) => {
		await new NewCamelRouteCommand('YAML').create(uri);
		await sendCommandTrackingEvent(NewCamelRouteCommand.ID_COMMAND_CAMEL_ROUTE_JBANG_YAML);
	}));
	context.subscriptions.push(vscode.commands.registerCommand(NewCamelKameletCommand.ID_COMMAND_CAMEL_ROUTE_KAMELET_YAML, async (uri: vscode.Uri) => {
		await new NewCamelKameletCommand('YAML').create(uri);
		await sendCommandTrackingEvent(NewCamelKameletCommand.ID_COMMAND_CAMEL_ROUTE_KAMELET_YAML);
	}));
	context.subscriptions.push(vscode.commands.registerCommand(NewCamelPipeCommand.ID_COMMAND_CAMEL_ROUTE_PIPE_YAML, async (uri: vscode.Uri) => {
		await new NewCamelPipeCommand('YAML').create(uri);
		await sendCommandTrackingEvent(NewCamelPipeCommand.ID_COMMAND_CAMEL_ROUTE_PIPE_YAML);
	}));

	// register commands for a new Camel projects --> spring-boot / quarkus
	context.subscriptions.push(vscode.commands.registerCommand(NewCamelProjectCommand.ID_COMMAND_CAMEL_NEW_PROJECT, async (uri: vscode.Uri) => {
		await new NewCamelProjectCommand().create();
		await sendCommandTrackingEvent(NewCamelProjectCommand.ID_COMMAND_CAMEL_NEW_PROJECT);
	}));
	context.subscriptions.push(vscode.commands.registerCommand(NewCamelQuarkusProjectCommand.ID_COMMAND_CAMEL_QUARKUS_PROJECT, async () => {
		await new NewCamelQuarkusProjectCommand().create();
		await sendCommandTrackingEvent(NewCamelQuarkusProjectCommand.ID_COMMAND_CAMEL_QUARKUS_PROJECT);
	}));
	context.subscriptions.push(vscode.commands.registerCommand(NewCamelSpringBootProjectCommand.ID_COMMAND_CAMEL_SPRINGBOOT_PROJECT, async () => {
		await new NewCamelSpringBootProjectCommand().create();
		await sendCommandTrackingEvent(NewCamelSpringBootProjectCommand.ID_COMMAND_CAMEL_SPRINGBOOT_PROJECT);
	}));

	// register deployments inline buttons
	context.subscriptions.push(vscode.commands.registerCommand('kaoto.deployments.integration.stop', async function (integration: ParentItem) {
		await new CamelStopJBangTask(integration.label).execute();
		await new Promise((time) => setTimeout(time, 750)); // TODO remove static time, at the moment just to give some more time to ensure Camel JBang reflects properly new state
		deploymentsProvider.refresh();
		await sendCommandTrackingEvent('kaoto.deployments.integration.stop');
	}));
	context.subscriptions.push(vscode.commands.registerCommand('kaoto.deployments.integration.logs', async function (integration: ParentItem) {
		await new CamelLogJBangTask(integration.label).executeOnly();
		await sendCommandTrackingEvent('kaoto.deployments.integration.logs');
	}));
	context.subscriptions.push(vscode.commands.registerCommand('kaoto.deployments.start', async function (route: ChildItem) {
		await new CamelRouteOperationJBangTask(RouteOperation.start, route.integrationName, route.label).execute();
		await new Promise((time) => setTimeout(time, 750)); // TODO remove static time, at the moment just to give some more time to ensure Camel JBang reflects properly new state
		deploymentsProvider.refresh();
		await sendCommandTrackingEvent('kaoto.deployments.start');
	}));
	context.subscriptions.push(vscode.commands.registerCommand('kaoto.deployments.stop', async function (route: ChildItem) {
		await new CamelRouteOperationJBangTask(RouteOperation.stop, route.integrationName, route.label).execute();
		await new Promise((time) => setTimeout(time, 750)); // TODO remove static time, at the moment just to give some more time to ensure Camel JBang reflects properly new state
		deploymentsProvider.refresh();
		await sendCommandTrackingEvent('kaoto.deployments.stop');
	}));
	context.subscriptions.push(vscode.commands.registerCommand('kaoto.deployments.resume', async function (route: ChildItem) {
		await new CamelRouteOperationJBangTask(RouteOperation.resume, route.integrationName, route.label).execute();
		await new Promise((time) => setTimeout(time, 750)); // TODO remove static time, at the moment just to give some more time to ensure Camel JBang reflects properly new state
		deploymentsProvider.refresh();
		await sendCommandTrackingEvent('kaoto.deployments.resume');
	}));
	context.subscriptions.push(vscode.commands.registerCommand('kaoto.deployments.suspend', async function (route: ChildItem) {
		await new CamelRouteOperationJBangTask(RouteOperation.suspend, route.integrationName, route.label).execute();
		await new Promise((time) => setTimeout(time, 750)); // TODO remove static time, at the moment just to give some more time to ensure Camel JBang reflects properly new state
		deploymentsProvider.refresh();
		await sendCommandTrackingEvent('kaoto.deployments.suspend');
	}));

	// show warning message when JBang is not found on a system PATH
	const jbangExec = await verifyJBangIsInstalled();
	if (!jbangExec) {
		const jbangINstallationLink: string = 'https://www.jbang.dev/documentation/guide/latest/installation.html';
		const selection = await vscode.window.showWarningMessage(`JBang is missing on a system PATH. Please follow instructions below and install JBang. [JBang Installation Guide](${jbangINstallationLink}).`, 'Install');
		if (selection !== undefined) {
			await vscode.commands.executeCommand('vscode.open', `${jbangINstallationLink}`);
		}
	}
}

async function sendCommandTrackingEvent(commandId: string) {
	const telemetryEvent: TelemetryEvent = {
		type: 'track',
		name: 'command',
		properties: {
			identifier: commandId
		}
	};
	await telemetryService.send(telemetryEvent);
}

export function deactivate() {
	backendProxy?.stopServices();
	telemetryService.sendShutdownEvent();
}
