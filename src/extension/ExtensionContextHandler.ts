/**
 * Copyright 2025 Red Hat, Inc. and/or its affiliates.
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
import * as vscode from 'vscode';
import * as KogitoVsCode from '@kie-tools-core/vscode-extension/dist';
import { execSync } from 'child_process';
import { HelpFeedbackProvider } from '../views/providers/HelpFeedbackProvider';
import { IntegrationsProvider } from '../views/providers/IntegrationsProvider';
import { Integration } from '../views/integrationTreeItems/Integration';
import { NewCamelRouteCommand } from '../commands/NewCamelRouteCommand';
import { NewCamelKameletCommand } from '../commands/NewCamelKameletCommand';
import { NewCamelPipeCommand } from '../commands/NewCamelPipeCommand';
import { verifyCamelJBangTrustedSource, verifyCamelKubernetesPluginIsInstalled, verifyJBangExists } from '../helpers/helpers';
import { KaotoOutputChannel } from './KaotoOutputChannel';
import { NewCamelFileCommand } from '../commands/NewCamelFileCommand';
import { confirmFileDeleteDialog } from '../helpers/modals';
import { TelemetryEvent, TelemetryService } from '@redhat-developer/vscode-redhat-telemetry';
import { NewCamelProjectCommand } from '../commands/NewCamelProjectCommand';
import { CamelRunJBangTask } from '../tasks/CamelRunJBangTask';
import { CamelAddPluginJBangTask } from '../tasks/CamelAddPluginJBangTask';
import { CamelKubernetesRunJBangTask } from '../tasks/CamelKubernetesRunJBangTask';
import { DeploymentsProvider } from '../views/providers/DeploymentsProvider';
import { PortManager } from '../helpers/PortManager';
import { ParentItem } from '../views/deploymentTreeItems/ParentItem';
import { CamelStopJBangTask } from '../tasks/CamelStopJBangTask';
import { ChildItem } from '../views/deploymentTreeItems/ChildItem';
import { CamelRouteOperationJBangTask } from '../tasks/CamelRouteOperationJBangTask';
import { RouteOperation } from '../helpers/CamelJBang';
import { RecommendationCore } from '@redhat-developer/vscode-extension-proposals';

export class ExtensionContextHandler {
	protected kieEditorStore: KogitoVsCode.VsCodeKieEditorStore;
	protected context: vscode.ExtensionContext;

	constructor(
		context: vscode.ExtensionContext,
		kieEditorStore: KogitoVsCode.VsCodeKieEditorStore,
		readonly telemetryService: TelemetryService | undefined,
	) {
		this.kieEditorStore = kieEditorStore;
		this.context = context;
	}

	public async showRecommendedExtensions() {
		const recommendService = RecommendationCore.getService(this.context);
		if (recommendService) {
			const xml = recommendService.create(
				'redhat.vscode-xml',
				'XML Language Support by Red Hat',
				'Provides support for creating and editing XML documents.',
				true,
			);
			const yaml = recommendService.create(
				'redhat.vscode-yaml',
				'YAML Language Support by Red Hat',
				'Provides comprehensive YAML Language support with built-in Kubernetes syntax support.',
				true,
			);
			await recommendService.register([xml, yaml]);
		}
	}

	public isWorkspaceVirtual(): boolean | undefined {
		return vscode.workspace.workspaceFolders?.every((f) => f.uri.scheme !== 'file');
	}

	public async checkJbangOnPath(): Promise<boolean> {
		const jbangExec = await verifyJBangExists();
		await vscode.commands.executeCommand('setContext', 'kaoto.jbangAvailable', jbangExec); // store availability in VS Code context
		if (!jbangExec) {
			const jbangInstallationLink: string = 'https://www.jbang.dev/documentation/guide/latest/installation.html';
			const msg: string = `JBang is missing on a system PATH. Please follow instructions below and install JBang. [JBang Installation Guide](${jbangInstallationLink}).`;
			KaotoOutputChannel.logWarning(msg);
			const selection = await vscode.window.showWarningMessage(msg, 'Install');
			if (selection !== undefined) {
				await vscode.commands.executeCommand('vscode.open', `${jbangInstallationLink}`);
			} else {
				await vscode.window.showWarningMessage('JBang is not installed. Some Kaoto extension features may not work properly.', 'OK');
			}
			return false;
		}
		return true;
	}

	public async checkCamelJbangTrustedSource() {
		const camelTrustedSource = await verifyCamelJBangTrustedSource();
		if (!camelTrustedSource) {
			const camelTrustUrl: string = 'https://github.com/apache/camel/';
			execSync(`jbang trust add ${camelTrustUrl}`, { stdio: ['pipe', 'pipe', process.stderr] });
			KaotoOutputChannel.logInfo('Apache Camel Trusted Source was added into JBang configuration.');
		}
	}

	public async registerToggleSourceCode() {
		const OPEN_SOURCE_COMMAND_ID: string = 'kaoto.open.source';
		const CLOSE_SOURCE_COMMAND_ID: string = 'kaoto.close.source';

		this.context.subscriptions.push(
			vscode.commands.registerCommand(OPEN_SOURCE_COMMAND_ID, async () => {
				if (this.kieEditorStore.activeEditor !== undefined) {
					const doc = await vscode.workspace.openTextDocument(this.kieEditorStore.activeEditor?.document.document.uri);
					await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
					await this.sendCommandTrackingEvent(OPEN_SOURCE_COMMAND_ID);
				}
			}),
		);
		this.context.subscriptions.push(
			vscode.commands.registerCommand(CLOSE_SOURCE_COMMAND_ID, async () => {
				await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
				await this.sendCommandTrackingEvent(CLOSE_SOURCE_COMMAND_ID);
			}),
		);
	}

	public registerOpenWithKaoto() {
		const OPEN_WITH_KAOTO_COMMAND_ID: string = 'kaoto.open';
		this.context.subscriptions.push(
			vscode.commands.registerCommand(OPEN_WITH_KAOTO_COMMAND_ID, async (uri: vscode.Uri) => {
				await vscode.commands.executeCommand('vscode.openWith', uri, 'webviewEditorsKaoto');
				await this.sendCommandTrackingEvent(OPEN_WITH_KAOTO_COMMAND_ID);
			}),
		);
	}

	public registerHelpAndFeedbackView() {
		this.context.subscriptions.push(vscode.window.registerTreeDataProvider('kaoto.help', new HelpFeedbackProvider(this.context.extensionUri.path)));
	}

	public registerIntegrationsView() {
		const integrationsProvider = new IntegrationsProvider(this.context.extensionUri.path);
		const integrationsTreeView = vscode.window.createTreeView('kaoto.integrations', {
			treeDataProvider: integrationsProvider,
			showCollapseAll: true,
		});
		this.context.subscriptions.push(integrationsTreeView);
		this.context.subscriptions.push(vscode.commands.registerCommand('kaoto.integrations.refresh', () => integrationsProvider.refresh()));
		this.registerIntegrationsItemsContextMenu();
	}

	public registerDeploymentsView(portManager: PortManager) {
		const deploymentsProvider = new DeploymentsProvider(portManager);
		this.context.subscriptions.push(vscode.commands.registerCommand('kaoto.deployments.refresh', () => deploymentsProvider.refresh()));
		this.context.subscriptions.push({
			dispose: () => deploymentsProvider.dispose(),
		});

		const deploymentsTreeView = vscode.window.createTreeView('kaoto.deployments', {
			treeDataProvider: deploymentsProvider,
			showCollapseAll: true,
		});
		this.context.subscriptions.push(deploymentsTreeView);

		// stop auto-refresh when a view is not visible
		this.context.subscriptions.push(
			deploymentsTreeView.onDidChangeVisibility((event) => {
				if (event.visible) {
					deploymentsProvider.refresh();
				} else {
					console.warn('[DeploymentsProvider] Auto-refresh stopped');
					deploymentsProvider.dispose();
				}
			}),
		);

		// register Stop and Logs view item action buttons
		this.registerDeploymentsIntegrationCommands();
		// register Stop/Start/Resume/Suspend route level buttons
		this.registerDeploymentsRouteCommands(deploymentsProvider);
	}

	private registerIntegrationsItemsContextMenu() {
		const INTEGRATIONS_SHOW_SOURCE_COMMAND_ID: string = 'kaoto.integrations.showSource';
		const INTEGRATIONS_DELETE_COMMAND_ID: string = 'kaoto.integrations.delete';

		// register show source menu button
		this.context.subscriptions.push(
			vscode.commands.registerCommand(INTEGRATIONS_SHOW_SOURCE_COMMAND_ID, async (integration: Integration) => {
				await vscode.window.showTextDocument(integration.filepath);
				await this.sendCommandTrackingEvent(INTEGRATIONS_SHOW_SOURCE_COMMAND_ID);
			}),
		);
		// register delete menu button
		this.context.subscriptions.push(
			vscode.commands.registerCommand(INTEGRATIONS_DELETE_COMMAND_ID, async (integration: Integration) => {
				const confirmation = await confirmFileDeleteDialog(integration.filename);
				if (confirmation) {
					await vscode.workspace.fs.delete(integration.filepath);
					KaotoOutputChannel.logInfo(`File '${integration.filepath}' was deleted.`);
				}
				await this.sendCommandTrackingEvent(INTEGRATIONS_DELETE_COMMAND_ID);
			}),
		);
	}

	public registerNewCamelFilesCommands() {
		// register custom command for a Camel YAML or XML file creation (eg. used in Integrations view Welcome Content)
		this.context.subscriptions.push(
			vscode.commands.registerCommand(NewCamelFileCommand.ID_COMMAND_CAMEL_NEW_FILE, async () => {
				await new NewCamelFileCommand().create();
				await this.sendCommandTrackingEvent(NewCamelFileCommand.ID_COMMAND_CAMEL_NEW_FILE);
			}),
		);
		// register commands for new Camel files creation using YAML or XML DSL - Camel Routes
		this.context.subscriptions.push(
			vscode.commands.registerCommand(NewCamelRouteCommand.ID_COMMAND_CAMEL_ROUTE, async () => {
				await new NewCamelRouteCommand().create();
				await this.sendCommandTrackingEvent(NewCamelRouteCommand.ID_COMMAND_CAMEL_ROUTE);
			}),
		);
		// register commands for new Camel files creation using YAML DSL - Kamelets, Pipes
		this.context.subscriptions.push(
			vscode.commands.registerCommand(NewCamelKameletCommand.ID_COMMAND_CAMEL_KAMELET_YAML, async () => {
				await new NewCamelKameletCommand('YAML').create();
				await this.sendCommandTrackingEvent(NewCamelKameletCommand.ID_COMMAND_CAMEL_KAMELET_YAML);
			}),
		);
		this.context.subscriptions.push(
			vscode.commands.registerCommand(NewCamelPipeCommand.ID_COMMAND_CAMEL_PIPE_YAML, async () => {
				await new NewCamelPipeCommand('YAML').create();
				await this.sendCommandTrackingEvent(NewCamelPipeCommand.ID_COMMAND_CAMEL_PIPE_YAML);
			}),
		);
	}

	public registerNewCamelProjectCommands() {
		this.context.subscriptions.push(
			vscode.commands.registerCommand(NewCamelProjectCommand.ID_COMMAND_CAMEL_NEW_PROJECT, async (integration: Integration) => {
				await new NewCamelProjectCommand().create(integration.filepath);
				await this.sendCommandTrackingEvent(NewCamelProjectCommand.ID_COMMAND_CAMEL_NEW_PROJECT);
			}),
		);
	}

	public registerRunIntegrationCommands(portManager: PortManager) {
		const INTEGRATIONS_RUN_COMMAND_ID: string = 'kaoto.integrations.run';

		this.context.subscriptions.push(
			vscode.commands.registerCommand(INTEGRATIONS_RUN_COMMAND_ID, async (integration: Integration) => {
				const port = await portManager.allocatePort();
				const runTask = await CamelRunJBangTask.create(integration.filepath.fsPath, port);
				await runTask.execute();
				await this.sendCommandTrackingEvent(INTEGRATIONS_RUN_COMMAND_ID);
			}),
		);
	}

	public registerKubernetesRunCommands() {
		const INTEGRATIONS_KUBERNETES_RUN_COMMAND_ID: string = 'kaoto.integrations.kubernetes.run';

		this.context.subscriptions.push(
			vscode.commands.registerCommand(INTEGRATIONS_KUBERNETES_RUN_COMMAND_ID, async (integration: Integration) => {
				if (!(await verifyCamelKubernetesPluginIsInstalled())) {
					await new CamelAddPluginJBangTask('kubernetes').executeAndWait();
					KaotoOutputChannel.logInfo('Apache Camel JBang Kubernetes plugin was installed.');
				}
				await new CamelKubernetesRunJBangTask(integration.filepath.fsPath).execute();
				await this.sendCommandTrackingEvent(INTEGRATIONS_KUBERNETES_RUN_COMMAND_ID);
			}),
		);
	}

	public registerDeploymentsIntegrationCommands() {
		const DEPLOYMENTS_INTEGRATION_STOP_COMMAND_ID: string = 'kaoto.deployments.stop';
		const DEPLOYMENTS_INTEGRATION_LOGS_COMMAND_ID: string = 'kaoto.deployments.logs';

		this.context.subscriptions.push(
			vscode.commands.registerCommand(DEPLOYMENTS_INTEGRATION_STOP_COMMAND_ID, async (integration: ParentItem) => {
				await new CamelStopJBangTask(integration.label as string).executeAndWait();
				await this.sendCommandTrackingEvent(DEPLOYMENTS_INTEGRATION_STOP_COMMAND_ID);
			}),
		);

		this.context.subscriptions.push(
			vscode.commands.registerCommand(DEPLOYMENTS_INTEGRATION_LOGS_COMMAND_ID, async (integration: ParentItem) => {
				const runningLabel = `Running - ${integration.description as string}::${integration.port}`;
				const terminal = vscode.window.terminals.find((t) => t.name === runningLabel);
				if (terminal) {
					terminal.show();
				} else {
					KaotoOutputChannel.logWarning(`Terminal with a name "${runningLabel}" was not found.`);
				}
				await this.sendCommandTrackingEvent(DEPLOYMENTS_INTEGRATION_LOGS_COMMAND_ID);
			}),
		);
	}

	public registerDeploymentsRouteCommands(deploymentsProvider: DeploymentsProvider) {
		const DEPLOYMENTS_ROUTE_START_COMMAND_ID: string = 'kaoto.deployments.route.start';
		const DEPLOYMENTS_ROUTE_STOP_COMMAND_ID: string = 'kaoto.deployments.route.stop';
		const DEPLOYMENTS_ROUTE_RESUME_COMMAND_ID: string = 'kaoto.deployments.route.resume';
		const DEPLOYMENTS_ROUTE_SUSPEND_COMMAND_ID: string = 'kaoto.deployments.route.suspend';

		this.context.subscriptions.push(
			vscode.commands.registerCommand(DEPLOYMENTS_ROUTE_START_COMMAND_ID, async (route: ChildItem) => {
				await new CamelRouteOperationJBangTask(RouteOperation.start, route.parentIntegration.label as string, route.label as string).executeAndWait();
				await deploymentsProvider.waitUntilRouteHasState(route.parentIntegration.port, route.label as string, 'Started');
				deploymentsProvider.refresh();
				await this.sendCommandTrackingEvent(DEPLOYMENTS_ROUTE_START_COMMAND_ID);
			}),
		);
		this.context.subscriptions.push(
			vscode.commands.registerCommand(DEPLOYMENTS_ROUTE_STOP_COMMAND_ID, async (route: ChildItem) => {
				await new CamelRouteOperationJBangTask(RouteOperation.stop, route.parentIntegration.label as string, route.label as string).executeAndWait();
				await deploymentsProvider.waitUntilRouteHasState(route.parentIntegration.port, route.label as string, 'Stopped');
				deploymentsProvider.refresh();
				await this.sendCommandTrackingEvent(DEPLOYMENTS_ROUTE_STOP_COMMAND_ID);
			}),
		);
		this.context.subscriptions.push(
			vscode.commands.registerCommand(DEPLOYMENTS_ROUTE_RESUME_COMMAND_ID, async (route: ChildItem) => {
				await new CamelRouteOperationJBangTask(RouteOperation.resume, route.parentIntegration.label as string, route.label as string).executeAndWait();
				await deploymentsProvider.waitUntilRouteHasState(route.parentIntegration.port, route.label as string, 'Started');
				deploymentsProvider.refresh();
				await this.sendCommandTrackingEvent(DEPLOYMENTS_ROUTE_RESUME_COMMAND_ID);
			}),
		);
		this.context.subscriptions.push(
			vscode.commands.registerCommand(DEPLOYMENTS_ROUTE_SUSPEND_COMMAND_ID, async (route: ChildItem) => {
				await new CamelRouteOperationJBangTask(RouteOperation.suspend, route.parentIntegration.label as string, route.label as string).executeAndWait();
				await deploymentsProvider.waitUntilRouteHasState(route.parentIntegration.port, route.label as string, 'Suspended');
				deploymentsProvider.refresh();
				await this.sendCommandTrackingEvent(DEPLOYMENTS_ROUTE_SUSPEND_COMMAND_ID);
			}),
		);
	}

	private async sendCommandTrackingEvent(commandId: string) {
		const telemetryEvent: TelemetryEvent = {
			type: 'track',
			name: 'command',
			properties: {
				identifier: commandId,
			},
		};
		if (this.telemetryService) {
			await this.telemetryService.send(telemetryEvent);
		}
	}
}
