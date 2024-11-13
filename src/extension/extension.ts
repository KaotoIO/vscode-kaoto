/**
 * Copyright 2021 Red Hat, Inc. and/or its affiliates.
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
import { KAOTO_FILE_PATH_GLOB, isCamelPluginInstalled } from "../helpers/helpers";
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
import { IntegrationsProvider, Integration } from "../views/IntegrationsProvider";

let backendProxy: VsCodeBackendProxy;
let telemetryService: TelemetryService;

export const WORKSPACE_WARNING_MESSAGE = `The action requires an opened folder/workspace to complete successfully.`;
export const CAMEL_JBANG_KUBERNETES_RUN_COMMAND_ID = 'camel.jbang.kubernetes.run';
export const CAMEL_JBANG_RUN_COMMAND_ID = 'camel.jbang.run';
export const CAMEL_JBANG_RUN_ALL_ROOT_COMMAND_ID = 'camel.jbang.run.all.root';
export const CAMEL_JBANG_RUN_ALL_FOLDER_COMMAND_ID = 'camel.jbang.run.all.folder';

export async function activate(context: vscode.ExtensionContext) {
	console.info("Kaoto extension is alive.");

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
		channelApiProducer: new VSCodeKaotoChannelApiProducer(),
		backendProxy: backendProxy,
	});

	// register command for open camel source code in side to side editor
	context.subscriptions.push(vscode.commands.registerCommand('kaoto.open.source', async () => {
		if (kieEditorStore.activeEditor !== undefined) {
			const doc = await vscode.workspace.openTextDocument(kieEditorStore.activeEditor?.document.document.uri);
			await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
		}
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

	// register command for deployment into kubernetes clusters
	context.subscriptions.push(vscode.commands.registerCommand(CAMEL_JBANG_KUBERNETES_RUN_COMMAND_ID, async function () {
		if (!(await isCamelPluginInstalled('kubernetes'))) {
			await new CamelAddPluginJBangTask('kubernetes').execute();
		}
		await new CamelKubernetesRunJBangTask('${relativeFile}').execute();
		await sendCommandTrackingEvent(CAMEL_JBANG_KUBERNETES_RUN_COMMAND_ID);
	}));

	// register commands for local camel jbang run
	context.subscriptions.push(vscode.commands.registerCommand(CAMEL_JBANG_RUN_COMMAND_ID, async function () {
		if (!vscode.workspace.workspaceFolders) {
			await vscode.window.showWarningMessage(WORKSPACE_WARNING_MESSAGE);
			return;
		}
		await new CamelRunJBangTask('${relativeFile}').executeOnly();
		await sendCommandTrackingEvent(CAMEL_JBANG_RUN_COMMAND_ID);
	}));
	context.subscriptions.push(vscode.commands.registerCommand(CAMEL_JBANG_RUN_ALL_ROOT_COMMAND_ID, async function () {
		if (!vscode.workspace.workspaceFolders) {
			await vscode.window.showWarningMessage(WORKSPACE_WARNING_MESSAGE);
			return;
		}
		await new CamelRunJBangTask('*').executeOnly();
		await sendCommandTrackingEvent(CAMEL_JBANG_RUN_ALL_ROOT_COMMAND_ID);
	}));
	context.subscriptions.push(vscode.commands.registerCommand(CAMEL_JBANG_RUN_ALL_FOLDER_COMMAND_ID, async function () {
		if (!vscode.workspace.workspaceFolders) {
			await vscode.window.showWarningMessage(WORKSPACE_WARNING_MESSAGE);
			return;
		}
		await new CamelRunJBangTask('*', '${fileDirname}').executeOnly();
		await sendCommandTrackingEvent(CAMEL_JBANG_RUN_ALL_FOLDER_COMMAND_ID);
	}));

	// register integrations view provider
	const rootPath = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
		? vscode.workspace.workspaceFolders[0].uri.fsPath
		: undefined;
	if (rootPath) {
		const integrationsProvider = new IntegrationsProvider(rootPath);
		// vscode.window.createTreeView('camel.integrations', {
		// 	integrationsDataProvider: integrationsProvider
		// });
		vscode.window.registerTreeDataProvider('camel.integrations', integrationsProvider);
		vscode.commands.registerCommand('camel.integrations.refresh', () => integrationsProvider.refresh());
	}
	context.subscriptions.push(vscode.commands.registerCommand('camel.integrations.editEntry', async (integrationEntry: Integration) => {
		await vscode.commands.executeCommand('kaoto.open', vscode.Uri.parse(integrationEntry.filepath));
	}));
	context.subscriptions.push(vscode.commands.registerCommand('camel.integrations.deleteEntry', async (integrationEntry: Integration) => {
		await vscode.window.showWarningMessage(`TODO: Removing '${integrationEntry.name}' integration`);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('camel.integrations.jbang.run', async function (integrationEntry: Integration) {
		if (!vscode.workspace.workspaceFolders) {
			await vscode.window.showWarningMessage(WORKSPACE_WARNING_MESSAGE);
			return;
		}
		await new CamelRunJBangTask(integrationEntry.filepath).executeOnly();
		await sendCommandTrackingEvent('camel.integrations.jbang.run');
	}));

	// register deployments view provider
	// TODO
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
