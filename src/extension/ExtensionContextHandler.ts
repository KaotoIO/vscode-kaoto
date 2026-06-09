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
import path from 'path';
import * as KogitoVsCode from '@kie-tools-core/vscode-extension/dist';
import { HelpFeedbackProvider } from '../views/providers/HelpFeedbackProvider';
import { IntegrationsProvider } from '../views/providers/IntegrationsProvider';
import { Integration } from '../views/integrationTreeItems/Integration';
import { NewCamelRouteCommand } from '../commands/NewCamelRouteCommand';
import { NewCamelKameletCommand } from '../commands/NewCamelKameletCommand';
import { NewCamelPipeCommand } from '../commands/NewCamelPipeCommand';
import {
	CAMEL_TRUSTED_SOURCE_URL,
	CITRUS_TRUSTED_SOURCE_URL,
	COMMAND_CAMEL_NEW_FILE,
	COMMAND_CLOSE_SOURCE,
	COMMAND_DEPLOYMENTS_LOGS,
	COMMAND_DEPLOYMENTS_REFRESH,
	COMMAND_DEPLOYMENTS_ROUTE_RESUME,
	COMMAND_DEPLOYMENTS_ROUTE_START,
	COMMAND_DEPLOYMENTS_ROUTE_STOP,
	COMMAND_DEPLOYMENTS_ROUTE_SUSPEND,
	COMMAND_DEPLOYMENTS_STOP,
	COMMAND_INTEGRATIONS_DELETE,
	COMMAND_INTEGRATIONS_KUBERNETES_RUN,
	COMMAND_INTEGRATIONS_REFRESH,
	COMMAND_INTEGRATIONS_RUN,
	COMMAND_INTEGRATIONS_RUN_ALL_WORKSPACES,
	COMMAND_INTEGRATIONS_RUN_FOLDER,
	COMMAND_INTEGRATIONS_RUN_WORKSPACE,
	COMMAND_INTEGRATIONS_SHOW_SOURCE,
	COMMAND_INTEGRATIONS_UPDATE_DEPENDENCIES,
	COMMAND_OPEN_SOURCE,
	COMMAND_OPEN_WITH_KAOTO,
	COMMAND_OPENAPI_IMPORT,
	COMMAND_OPENAPI_REFRESH,
	COMMAND_REDO,
	COMMAND_TESTS_CLEAR_RESULTS,
	COMMAND_TESTS_REFRESH,
	COMMAND_TESTS_RUN,
	COMMAND_TESTS_RUN_FOLDER,
	COMMAND_TESTS_DELETE,
	COMMAND_TESTS_SHOW_SOURCE,
	COMMAND_OPENAPI_DELETE,
	COMMAND_OPENAPI_SHOW_SOURCE,
	COMMAND_UNDO,
	COMMAND_WHATS_NEW_SHOW,
	CONTEXT_EXECUTOR_AVAILABLE,
	CONTEXT_WORKSPACE_HAS_POM_XML,
	VIEW_OPENAPI,
	STATE_LAST_WHATS_NEW_SHOWN_VERSION,
	STATE_SHOW_RUN_ALL_FOLDERS_MESSAGE,
	KAOTO_EXECUTOR_TYPE_SETTING_ID,
	COMMAND_SELECT_CAMEL_CATALOG,
	VIEW_TESTS,
	VIEW_INTEGRATIONS,
	VIEW_HELP,
	VIEW_DEPLOYMENTS,
} from '../constants';
import {
	findFolderOfPomXml,
	runJBangCommandWithStatusBar,
	verifyJavaExists,
	verifyJBangExists,
	verifyJBangTrustedSources,
	verifyCamelPluginsAreInstalled,
	safeGlobalStateGet,
	safeGlobalStateUpdate,
} from '../helpers/helpers';
import { KaotoOutputChannel } from './KaotoOutputChannel';
import { NewCamelFileCommand } from '../commands/NewCamelFileCommand';
import { confirmFileDeleteDialog } from '../helpers/modals';
import { TelemetryEvent, TelemetryService } from '@redhat-developer/vscode-redhat-telemetry';
import { NewCamelProjectCommand } from '../commands/NewCamelProjectCommand';
import { CamelTaskFactory } from '../tasks/CamelTaskFactory';
import { CamelCommandAPI } from '../executors/api/CamelCommandAPI';
import { DeploymentsProvider } from '../views/providers/DeploymentsProvider';
import { PortManager } from '../helpers/PortManager';
import { ParentItem } from '../views/deploymentTreeItems/ParentItem';
import { RouteOperation } from '../types/RouteOperation';
import { ChildItem } from '../views/deploymentTreeItems/ChildItem';
import { RecommendationCore } from '@redhat-developer/vscode-extension-proposals';
import { WhatsNewPanel } from './WhatsNewPanel';
import { satisfies } from 'compare-versions';
import { StepsOnSaveManager } from '../helpers/StepsOnSaveManager';
import { Folder } from '../views/integrationTreeItems/Folder';
import { TestsProvider } from '../views/providers/TestsProvider';
import { AbstractFolderTreeProvider } from '../views/providers/AbstractFolderTreeProvider';
import { NewCamelTestCommand } from '../commands/NewCamelTestCommand';
import { TestFolder } from '../views/testTreeItems/TestFolder';
import { CamelTask, CamelTaskDefinition } from '../tasks/CamelTask';
import { Test } from '../views/testTreeItems/Test';
import { OpenApiProvider } from '../views/providers/OpenApiProvider';
import { ImportOpenApiCommand } from '../commands/ImportOpenApiCommand';
import { ensureExecutorAvailable } from '../executors/ExecutorInitializer';
import { KaotoCatalogService } from '../services/KaotoCatalogService';

export class ExtensionContextHandler {
	protected kieEditorStore: KogitoVsCode.VsCodeKieEditorStore;
	protected context: vscode.ExtensionContext;

	protected testsProvider: TestsProvider;
	protected deploymentsProvider: DeploymentsProvider;
	protected openApiProvider: OpenApiProvider;

	constructor(
		context: vscode.ExtensionContext,
		kieEditorStore: KogitoVsCode.VsCodeKieEditorStore,
		readonly telemetryService: TelemetryService | undefined,
	) {
		this.kieEditorStore = kieEditorStore;
		this.context = context;
	}

	/**
	 * Register executor-related configuration listeners, catalog selection command,
	 * and trigger initial executor setup (non-blocking).
	 */
	public registerExecutorSetup(catalogService: KaotoCatalogService): void {
		this.context.subscriptions.push(
			vscode.workspace.onDidChangeConfiguration(async (event) => {
				if (event.affectsConfiguration(KAOTO_EXECUTOR_TYPE_SETTING_ID)) {
					KaotoOutputChannel.logInfo('Executor type configuration changed, validating requirements...');

					ensureExecutorAvailable(this.context, this, true).catch((error) => {
						KaotoOutputChannel.logError('Failed to initialize executor after configuration change', error);
					});
				}
			}),
			vscode.commands.registerCommand(COMMAND_SELECT_CAMEL_CATALOG, async () => {
				const catalogSelected = await catalogService.showCatalogPicker();

				if (catalogSelected) {
					ensureExecutorAvailable(this.context, this, true).catch((error) => {
						KaotoOutputChannel.logError('Failed to initialize executor after catalog selection', error);
					});
				}
			}),
		);

		ensureExecutorAvailable(this.context, this).catch((error) => {
			KaotoOutputChannel.logError('Background executor setup failed', error);
		});
	}

	/**
	 * a workaround which is temporarily disabling shortcuts for undo/redo in Kaoto Editor
	 * Related issues:
	 * - https://github.com/KaotoIO/kaoto/issues/2521
	 * - https://github.com/KaotoIO/kaoto/issues/2524
	 * - https://github.com/KaotoIO/kaoto/issues/2525
	 */
	public registerUndoRedoCommands() {
		this.context.subscriptions.push(
			vscode.commands.registerCommand(COMMAND_UNDO, async () => {
				// do nothing
			}),
		);
		this.context.subscriptions.push(
			vscode.commands.registerCommand(COMMAND_REDO, async () => {
				// do nothing
			}),
		);
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

	public async checkJbangOnPath(): Promise<boolean> {
		return this.checkToolOnPath('JBang', verifyJBangExists, 'https://www.jbang.dev/documentation/jbang/latest/installation.html');
	}

	public async checkJavaOnPath(): Promise<boolean> {
		return this.checkToolOnPath('Java', verifyJavaExists, 'https://adoptium.net/installation/');
	}

	private async checkToolOnPath(toolName: string, verifyFn: () => Promise<boolean>, installUrl: string): Promise<boolean> {
		if (await verifyFn()) {
			return true;
		}
		const msg = `${toolName} is missing on a system PATH. Please follow instructions below and install ${toolName}. [${toolName} Installation Guide](${installUrl}).`;
		KaotoOutputChannel.logWarning(msg);
		const selection = await vscode.window.showWarningMessage(msg, 'Install');
		if (selection !== undefined) {
			await vscode.commands.executeCommand('vscode.open', installUrl);
		} else {
			await vscode.window.showWarningMessage(`${toolName} is not installed. Some Kaoto extension features may not work properly.`, 'OK');
		}
		return false;
	}

	public async setExecutorAvailable(available: boolean): Promise<void> {
		await vscode.commands.executeCommand('setContext', CONTEXT_EXECUTOR_AVAILABLE, available);
	}

	public async checkJBangTrustedSources() {
		const camelTrustedSources = await verifyJBangTrustedSources([CAMEL_TRUSTED_SOURCE_URL, CITRUS_TRUSTED_SOURCE_URL]);
		const camelTrustedSourcesToAdd = camelTrustedSources.filter((source) => !source.exists).map((source) => source.url);
		if (camelTrustedSourcesToAdd.length > 0) {
			const output = await runJBangCommandWithStatusBar(
				`trust add ${camelTrustedSourcesToAdd.join(' ')}`,
				`Adding [${camelTrustedSourcesToAdd.join(', ')}] into JBang configuration Trusted Sources...`,
			);
			if (output.stderr.length > 0 && output.stderr.toLowerCase().includes('error')) {
				const errorMessage = `Failed to add [${camelTrustedSourcesToAdd.join(', ')}] into JBang configuration Trusted Sources: ${output.stderr}`;
				KaotoOutputChannel.logError(errorMessage);
				vscode.window.showWarningMessage(errorMessage);
			} else {
				KaotoOutputChannel.logInfo(`[${camelTrustedSourcesToAdd.join(', ')}] were added into JBang configuration Trusted Sources.`);
			}
		}
	}

	public async checkCamelJBangPlugins() {
		const camelPlugins = await verifyCamelPluginsAreInstalled(['kubernetes', 'test']);
		const camelPluginsToInstall = camelPlugins.filter((plugin) => !plugin.installed).map((plugin) => plugin.plugin);
		if (camelPluginsToInstall.length > 0) {
			for (const plugin of camelPluginsToInstall) {
				const output = await runJBangCommandWithStatusBar(`camel@apache/camel plugin add ${plugin}`, `Adding Apache Camel JBang ${plugin} plugin...`);
				if (output.stderr.length > 0 && output.stderr.toLowerCase().includes('error')) {
					KaotoOutputChannel.logError(`Failed to add Apache Camel JBang ${plugin} plugin: ${output.stderr}`);
					vscode.window.showWarningMessage(`Failed to add Apache Camel JBang ${plugin} plugin: ${output.stderr}`);
				} else {
					KaotoOutputChannel.logInfo(`Apache Camel JBang ${plugin} plugin was installed.`);
				}
			}
		}
	}

	public async showWhatsNewIfNeeded() {
		const currentVersion = this.context.extension.packageJSON.version;
		this.context.subscriptions.push(
			vscode.commands.registerCommand(COMMAND_WHATS_NEW_SHOW, async () => {
				try {
					await WhatsNewPanel.show(this.context, currentVersion);
				} catch (err) {
					KaotoOutputChannel.logWarning(`Unable to show What's New: ${String(err)}`);
				}
			}),
		);
		try {
			if (!currentVersion) {
				return;
			}
			const storageKey = STATE_LAST_WHATS_NEW_SHOWN_VERSION;
			const lastShown = safeGlobalStateGet<string | undefined>(this.context, storageKey, undefined);

			// Only show What's New if lastShown is undefined (first install) or lastShown < currentVersion (upgrade)
			if (lastShown && satisfies(lastShown, `>=${currentVersion}`)) {
				return;
			}
			await WhatsNewPanel.show(this.context, currentVersion);
			await safeGlobalStateUpdate(this.context, storageKey, currentVersion);
		} catch (err) {
			KaotoOutputChannel.logWarning(`Unable to show What's New: ${String(err)}`);
		}
	}

	public async registerToggleSourceCode() {
		const OPEN_SOURCE_COMMAND_ID: string = COMMAND_OPEN_SOURCE;
		const CLOSE_SOURCE_COMMAND_ID: string = COMMAND_CLOSE_SOURCE;

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
		this.context.subscriptions.push(
			vscode.commands.registerCommand(COMMAND_OPEN_WITH_KAOTO, async (uri: vscode.Uri) => {
				await vscode.commands.executeCommand('vscode.openWith', uri, 'webviewEditorsKaoto');
				await this.sendCommandTrackingEvent(COMMAND_OPEN_WITH_KAOTO);
			}),
		);
	}

	public registerHelpAndFeedbackView() {
		this.context.subscriptions.push(vscode.window.registerTreeDataProvider(VIEW_HELP, new HelpFeedbackProvider(this.context.extensionUri.path)));
	}

	public registerIntegrationsView() {
		const integrationsProvider = new IntegrationsProvider(this.context.extensionUri.path);
		const integrationsTreeView = vscode.window.createTreeView(VIEW_INTEGRATIONS, {
			treeDataProvider: integrationsProvider,
			showCollapseAll: true,
		});
		const dispose = {
			dispose: () => integrationsProvider.dispose(),
		};
		const refreshCommand = vscode.commands.registerCommand(COMMAND_INTEGRATIONS_REFRESH, () => integrationsProvider.refresh());
		this.context.subscriptions.push(integrationsTreeView, dispose, refreshCommand);

		this.registerIntegrationsItemsContextMenu(integrationsProvider);
	}

	public registerTestsView() {
		this.testsProvider = new TestsProvider();
		const testsTreeView = vscode.window.createTreeView(VIEW_TESTS, {
			treeDataProvider: this.testsProvider,
			showCollapseAll: true,
		});
		const dispose = {
			dispose: () => this.testsProvider.dispose(),
		};

		const refreshOnVisibilityChange = testsTreeView.onDidChangeVisibility((event) => {
			if (event.visible) {
				this.testsProvider.refresh();
			}
		});
		const refreshCommand = vscode.commands.registerCommand(COMMAND_TESTS_REFRESH, () => this.testsProvider.refresh());
		const clearResultsCommand = vscode.commands.registerCommand(COMMAND_TESTS_CLEAR_RESULTS, () => this.testsProvider.clearAllResults());
		this.context.subscriptions.push(testsTreeView, dispose, refreshCommand, clearResultsCommand, refreshOnVisibilityChange);

		this.registerViewItemContextMenu(this.testsProvider, COMMAND_TESTS_SHOW_SOURCE, COMMAND_TESTS_DELETE);
	}

	public registerTestsInitCommands() {
		this.context.subscriptions.push(
			vscode.commands.registerCommand(NewCamelTestCommand.ID_COMMAND_CITRUS_INIT, async () => {
				await new NewCamelTestCommand().create();
				await this.sendCommandTrackingEvent(NewCamelTestCommand.ID_COMMAND_CITRUS_INIT);
			}),
		);
	}

	public registerTestsRunCommands() {
		const runCommand = vscode.commands.registerCommand(COMMAND_TESTS_RUN, async (test: Test) => {
			const filePath = test.resourceUri?.fsPath as string;
			const fileName = path.basename(filePath) || 'test';

			await this.executeTestRun(
				[filePath],
				async () => {
					const result = await CamelCommandAPI.testRun(path.basename(filePath), path.dirname(filePath));
					return CamelTaskFactory.createBackground(`Running - ${path.basename(filePath)}`, result);
				},
				`Running test: ${fileName}`,
			);
			await this.sendCommandTrackingEvent(COMMAND_TESTS_RUN);
		});

		const runFolderCommand = vscode.commands.registerCommand(COMMAND_TESTS_RUN_FOLDER, async (folder: TestFolder) => {
			const folderPath = folder.folderUri.fsPath;
			const folderName = path.basename(folderPath) || 'tests';

			const testFilePaths = await this.testsProvider.getTestFilesInFolder(folderPath);
			if (testFilePaths.length === 0) {
				vscode.window.showInformationMessage(`No test files found in folder: ${folderName}`);
				return;
			}

			await this.executeTestRun(
				testFilePaths,
				async () => {
					const result = await CamelCommandAPI.testRunFolder(folderPath);
					return CamelTaskFactory.createBackground(`Running - ${folderPath}`, result);
				},
				`Running tests in: ${folderName}`,
			);
			await this.sendCommandTrackingEvent(COMMAND_TESTS_RUN_FOLDER);
		});

		this.context.subscriptions.push(runCommand, runFolderCommand);
	}

	private async executeTestRun(testFilePaths: string[], createTask: () => Promise<CamelTask>, progressMessage: string): Promise<void> {
		for (const testPath of testFilePaths) {
			this.testsProvider.setTestRunning(testPath, true);
		}

		try {
			const runTask = await createTask();
			await runTask.executeAndWaitWithProgress(progressMessage);

			for (const testPath of testFilePaths) {
				const testResult = await this.testsProvider.readTestResult(testPath);
				this.testsProvider.setTestResult(testPath, testResult);
			}
		} catch {
			for (const testPath of testFilePaths) {
				this.testsProvider.setTestResult(testPath, 'failure');
			}
		} finally {
			for (const testPath of testFilePaths) {
				this.testsProvider.setTestRunning(testPath, false);
			}
		}
	}

	public registerDeploymentsView(portManager: PortManager) {
		this.deploymentsProvider = new DeploymentsProvider(portManager);

		const deploymentsTreeView = vscode.window.createTreeView(VIEW_DEPLOYMENTS, {
			treeDataProvider: this.deploymentsProvider,
			showCollapseAll: true,
		});

		const deploymentsRefreshCommand = vscode.commands.registerCommand(COMMAND_DEPLOYMENTS_REFRESH, () => this.deploymentsProvider.refresh());
		const deploymentsDispose = {
			dispose: () => this.deploymentsProvider.dispose(),
		};

		const refreshVisibilityChange = deploymentsTreeView.onDidChangeVisibility((event) => {
			if (event.visible) {
				this.deploymentsProvider.refresh();
			} else {
				console.warn('[DeploymentsProvider] Auto-refresh stopped');
				this.deploymentsProvider.dispose();
			}
		});

		this.context.subscriptions.push(deploymentsTreeView, deploymentsDispose, deploymentsRefreshCommand, refreshVisibilityChange);
	}

	public registerOpenApiView() {
		this.openApiProvider = new OpenApiProvider();
		const openApiTreeView = vscode.window.createTreeView(VIEW_OPENAPI, {
			treeDataProvider: this.openApiProvider,
			showCollapseAll: true,
		});
		const dispose = {
			dispose: () => this.openApiProvider.dispose(),
		};
		const refreshCommand = vscode.commands.registerCommand(COMMAND_OPENAPI_REFRESH, () => this.openApiProvider.refresh());
		this.context.subscriptions.push(openApiTreeView, dispose, refreshCommand);

		this.registerViewItemContextMenu(this.openApiProvider, COMMAND_OPENAPI_SHOW_SOURCE, COMMAND_OPENAPI_DELETE);
	}

	public registerOpenApiImportCommand() {
		const importCommand = vscode.commands.registerCommand(COMMAND_OPENAPI_IMPORT, async () => {
			await new ImportOpenApiCommand().create();
			await this.sendCommandTrackingEvent(COMMAND_OPENAPI_IMPORT);
		});

		this.context.subscriptions.push(importCommand);
	}

	private registerIntegrationsItemsContextMenu(provider: IntegrationsProvider) {
		// register show source menu button
		const showSourceCommand = vscode.commands.registerCommand(COMMAND_INTEGRATIONS_SHOW_SOURCE, async (item: vscode.TreeItem) => {
			if (!item.resourceUri) {
				return;
			}
			await vscode.window.showTextDocument(item.resourceUri);
			await this.sendCommandTrackingEvent(COMMAND_INTEGRATIONS_SHOW_SOURCE);
		});

		// register delete menu button
		const deleteCommand = vscode.commands.registerCommand(COMMAND_INTEGRATIONS_DELETE, async (item: vscode.TreeItem) => {
			if (!item.resourceUri) {
				return;
			}
			const confirmation = await confirmFileDeleteDialog(item.resourceUri.fsPath);
			if (confirmation) {
				await vscode.workspace.fs.delete(item.resourceUri, { recursive: true });
				// ensure tree refresh (folder deletions may not trigger file-pattern watcher)
				provider.refresh();
				KaotoOutputChannel.logInfo(`Item '${item.resourceUri.fsPath}' was deleted.`);
			}
			await this.sendCommandTrackingEvent(COMMAND_INTEGRATIONS_DELETE);
		});

		// register update dependencies menu button
		const updateDependenciesCommand = vscode.commands.registerCommand(COMMAND_INTEGRATIONS_UPDATE_DEPENDENCIES, async (integration: Integration) => {
			await this.updateCamelDependencies(integration.filepath.fsPath);
			await this.sendCommandTrackingEvent(COMMAND_INTEGRATIONS_UPDATE_DEPENDENCIES);
		});

		this.context.subscriptions.push(showSourceCommand, deleteCommand, updateDependenciesCommand);
	}

	private registerViewItemContextMenu(provider: AbstractFolderTreeProvider<any>, showSourceCommandId: string, deleteCommandId: string) {
		const showSourceCommand = vscode.commands.registerCommand(showSourceCommandId, async (item: vscode.TreeItem) => {
			if (!item.resourceUri) {
				return;
			}
			await vscode.window.showTextDocument(item.resourceUri);
			await this.sendCommandTrackingEvent(showSourceCommandId);
		});

		const deleteCommand = vscode.commands.registerCommand(deleteCommandId, async (item: vscode.TreeItem) => {
			if (!item.resourceUri) {
				return;
			}
			const confirmation = await confirmFileDeleteDialog(item.resourceUri.fsPath);
			if (confirmation) {
				await vscode.workspace.fs.delete(item.resourceUri, { recursive: true });
				// ensure tree refresh (folder deletions may not trigger file-pattern watcher)
				provider.refresh();
				KaotoOutputChannel.logInfo(`Item '${item.resourceUri.fsPath}' was deleted.`);
			}
			await this.sendCommandTrackingEvent(deleteCommandId);
		});

		this.context.subscriptions.push(showSourceCommand, deleteCommand);
	}

	private async updateCamelDependencies(docPath: string): Promise<void> {
		const pomFolder = findFolderOfPomXml(docPath);
		if (!pomFolder) {
			return; // standalone project
		}
		const pomPath = path.join(pomFolder, 'pom.xml');

		await StepsOnSaveManager.instance.updateDependencies(docPath, pomPath);
	}

	public registerNewCamelFilesCommands() {
		// register custom command for a Camel YAML or XML file creation (eg. used in Integrations view Welcome Content)
		this.context.subscriptions.push(
			vscode.commands.registerCommand(COMMAND_CAMEL_NEW_FILE, async () => {
				await new NewCamelFileCommand().create();
				await this.sendCommandTrackingEvent(COMMAND_CAMEL_NEW_FILE);
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
		const exportSingleFileCommand = vscode.commands.registerCommand(
			NewCamelProjectCommand.ID_COMMAND_CAMEL_NEW_PROJECT,
			async (integration: Integration) => {
				await new NewCamelProjectCommand().create(integration.filepath, path.dirname(integration.filepath.fsPath));
				await this.sendCommandTrackingEvent(NewCamelProjectCommand.ID_COMMAND_CAMEL_NEW_PROJECT);
			},
		);
		const exportFolderCommand = vscode.commands.registerCommand(NewCamelProjectCommand.ID_COMMAND_CAMEL_NEW_PROJECT_FOLDER, async (folder: Folder) => {
			await new NewCamelProjectCommand().create(folder.folderUri, folder.folderUri.fsPath);
			await this.sendCommandTrackingEvent(NewCamelProjectCommand.ID_COMMAND_CAMEL_NEW_PROJECT_FOLDER);
		});
		const exportWorkspaceCommand = vscode.commands.registerCommand(NewCamelProjectCommand.ID_COMMAND_CAMEL_NEW_PROJECT_WORKSPACE, async () => {
			if (!vscode.workspace.workspaceFolders?.[0]) {
				return;
			}
			const workspaceFolder = vscode.workspace.workspaceFolders[0];
			await new NewCamelProjectCommand().create(workspaceFolder.uri, workspaceFolder.uri.fsPath);
			await this.sendCommandTrackingEvent(NewCamelProjectCommand.ID_COMMAND_CAMEL_NEW_PROJECT_WORKSPACE);
		});
		this.context.subscriptions.push(exportSingleFileCommand, exportFolderCommand, exportWorkspaceCommand);
	}

	public registerRunIntegrationCommands(portManager: PortManager) {
		this.context.subscriptions.push(
			vscode.commands.registerCommand(COMMAND_INTEGRATIONS_RUN, async (integration: Integration) => {
				const allocatedPort = await portManager.allocatePort();
				const result = await CamelCommandAPI.run(integration.filepath.fsPath, path.dirname(integration.filepath.fsPath), allocatedPort);
				const runTask = CamelTaskFactory.createBackground(`Running - ${path.basename(integration.filepath.fsPath)}::${result.resolvedPort}`, result);

				this.synchronizePortTracking(portManager, runTask, allocatedPort);

				await runTask.execute();
				await this.sendCommandTrackingEvent(COMMAND_INTEGRATIONS_RUN);
			}),
		);
	}

	public registerRunSourceDirCommands(portManager: PortManager) {
		const runFolderCommand = vscode.commands.registerCommand(COMMAND_INTEGRATIONS_RUN_FOLDER, async (folder: Folder) => {
			await this.executeRunSourceDirTask(folder.folderUri.fsPath, portManager);
			await this.sendCommandTrackingEvent(COMMAND_INTEGRATIONS_RUN_FOLDER);
		});

		const runWorkspaceHandler = async (commandId: string, showMultiWorkspaceMessage: boolean): Promise<void> => {
			const folders = vscode.workspace.workspaceFolders;
			if (!folders?.length) {
				return;
			}

			const isMultiWorkspace = folders.length > 1;
			for (const folder of folders) {
				await this.executeRunSourceDirTask(folder.uri.fsPath, portManager);
			}

			if (showMultiWorkspaceMessage && isMultiWorkspace) {
				await this.showMultiWorkspaceInfoMessage();
			}

			await this.sendCommandTrackingEvent(commandId);
		};

		const runWorkspaceCommand = vscode.commands.registerCommand(COMMAND_INTEGRATIONS_RUN_WORKSPACE, async () =>
			runWorkspaceHandler(COMMAND_INTEGRATIONS_RUN_WORKSPACE, false),
		);

		const runAllCommand = vscode.commands.registerCommand(COMMAND_INTEGRATIONS_RUN_ALL_WORKSPACES, async () =>
			runWorkspaceHandler(COMMAND_INTEGRATIONS_RUN_ALL_WORKSPACES, true),
		);

		this.context.subscriptions.push(runFolderCommand, runWorkspaceCommand, runAllCommand);
	}

	public registerKubernetesRunCommands() {
		this.context.subscriptions.push(
			vscode.commands.registerCommand(COMMAND_INTEGRATIONS_KUBERNETES_RUN, async (integration: Integration) => {
				const deployResult = await CamelCommandAPI.kubernetesRun(integration.filepath.fsPath, path.dirname(integration.filepath.fsPath));
				const deployTask = CamelTaskFactory.create({ label: `Deploying - ${path.basename(integration.filepath.fsPath)}` }, deployResult);
				await deployTask.execute();
				await this.sendCommandTrackingEvent(COMMAND_INTEGRATIONS_KUBERNETES_RUN);
			}),
		);
	}

	public registerDeploymentsIntegrationCommands() {
		this.context.subscriptions.push(
			vscode.commands.registerCommand(COMMAND_DEPLOYMENTS_STOP, async (integration: ParentItem) => {
				const stopResult = await CamelCommandAPI.stop(integration.label as string);
				const stopTask = CamelTaskFactory.createSilent(`Stop - ${integration.label as string}`, stopResult);
				await stopTask.executeAndWait();
				await this.sendCommandTrackingEvent(COMMAND_DEPLOYMENTS_STOP);
			}),
		);

		this.context.subscriptions.push(
			vscode.commands.registerCommand(COMMAND_DEPLOYMENTS_LOGS, async (integration: ParentItem) => {
				const runningLabel = `Running - ${integration.description as string}::${integration.port}`;
				const terminal = vscode.window.terminals.find((t) => t.name === runningLabel);
				if (terminal) {
					terminal.show();
				} else {
					KaotoOutputChannel.logWarning(`Terminal with a name "${runningLabel}" was not found.`);
				}
				await this.sendCommandTrackingEvent(COMMAND_DEPLOYMENTS_LOGS);
			}),
		);
	}

	public registerDeploymentsRouteCommands() {
		const registerRouteCommand = (commandId: string, operation: RouteOperation, expectedState: 'Started' | 'Stopped' | 'Suspended') =>
			vscode.commands.registerCommand(commandId, async (route: ChildItem) => {
				const integrationName = route.parentIntegration.label as string;
				const routeName = route.label as string;
				const result = await CamelCommandAPI.routeOperation(operation, integrationName, routeName);
				const task = CamelTaskFactory.createSilent(`${operation} - ${integrationName}: ${routeName}`, result);
				await task.executeAndWait();
				await this.deploymentsProvider.waitUntilRouteHasState(route.parentIntegration.port, routeName, expectedState);
				this.deploymentsProvider.refresh();
				await this.sendCommandTrackingEvent(commandId);
			});

		this.context.subscriptions.push(
			registerRouteCommand(COMMAND_DEPLOYMENTS_ROUTE_START, RouteOperation.start, 'Started'),
			registerRouteCommand(COMMAND_DEPLOYMENTS_ROUTE_STOP, RouteOperation.stop, 'Stopped'),
			registerRouteCommand(COMMAND_DEPLOYMENTS_ROUTE_RESUME, RouteOperation.resume, 'Started'),
			registerRouteCommand(COMMAND_DEPLOYMENTS_ROUTE_SUSPEND, RouteOperation.suspend, 'Suspended'),
		);
	}

	public async hideIntegrationsViewButtonsForMavenProjects() {
		// Initial check
		await this.updatePomContext();

		// Watch for addition/removal of pom.xml in workspace root
		const pomWatcher = vscode.workspace.createFileSystemWatcher('**/pom.xml');
		pomWatcher.onDidCreate(() => this.updatePomContext());
		pomWatcher.onDidDelete(() => this.updatePomContext());
		pomWatcher.onDidChange(() => this.updatePomContext());
		this.context.subscriptions.push(pomWatcher);
	}

	private async updatePomContext() {
		const pomFile = await vscode.workspace.findFiles('pom.xml', IntegrationsProvider.EXCLUDE_PATTERN, 1);
		const hasPom = pomFile.length > 0;
		await vscode.commands.executeCommand('setContext', CONTEXT_WORKSPACE_HAS_POM_XML, hasPom);
	}

	/**
	 * Synchronizes the PortManager with the actual port used by a task.
	 * If the task's actual port differs from the allocated port (due to user override in settings),
	 * this method releases the allocated port and adds the actual port to the PortManager.
	 *
	 * @param portManager - The PortManager instance to synchronize
	 * @param task - The task whose port should be synchronized
	 * @param allocatedPort - The port that was originally allocated
	 */
	private synchronizePortTracking(portManager: PortManager, task: CamelTask, allocatedPort: number): void {
		const taskDef = task.definition as CamelTaskDefinition;
		const actualPort = taskDef.port;

		if (actualPort !== allocatedPort) {
			// User overrode the port in settings, update PortManager to track the actual port
			portManager.releasePort(allocatedPort);
			portManager.getUsedPorts().add(actualPort);
		}
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

	/**
	 * Executes a run source directory task for the specified folder path.
	 * Allocates a port, creates the task, synchronizes port tracking, and executes the task.
	 *
	 * @param folderPath - The file system path of the folder to run
	 * @param portManager - The PortManager instance for port allocation
	 */
	private async executeRunSourceDirTask(folderPath: string, portManager: PortManager): Promise<void> {
		const allocatedPort = await portManager.allocatePort();
		let runTask: CamelTask | undefined;

		try {
			const result = await CamelCommandAPI.runSourceDir(folderPath, allocatedPort);
			runTask = CamelTaskFactory.createBackground(`Running - ${path.basename(folderPath)}::${result.resolvedPort}`, result);
			this.synchronizePortTracking(portManager, runTask, allocatedPort);
			await runTask.execute();
		} catch (error) {
			const portToRelease = runTask ? (runTask.definition as CamelTaskDefinition).port : allocatedPort;
			portManager.releasePort(portToRelease);
			throw error;
		}
	}

	/**
	 * Shows an informational message to the user when running multiple workspaces.
	 * The message can be dismissed permanently by the user.
	 */
	private async showMultiWorkspaceInfoMessage(): Promise<void> {
		const storageKey = STATE_SHOW_RUN_ALL_FOLDERS_MESSAGE;
		const showInfoMessage = safeGlobalStateGet<boolean>(this.context, storageKey, true);

		if (showInfoMessage) {
			const doNotShowAgain = "Don't show again";
			const ok = 'OK';
			const result = await vscode.window.showInformationMessage(
				'You are running multiple workspaces. Each workspace will be run in a separate terminal.',
				ok,
				doNotShowAgain,
			);
			if (result === doNotShowAgain) {
				await safeGlobalStateUpdate(this.context, storageKey, false);
			}
		}
	}
}
