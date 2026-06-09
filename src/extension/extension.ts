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
import { backendI18nDefaults, backendI18nDictionaries } from '@kie-tools-core/backend/dist/i18n';
import { VsCodeBackendProxy } from '@kie-tools-core/backend/dist/vscode';
import { EditorEnvelopeLocator, EnvelopeContentType, EnvelopeMapping } from '@kie-tools-core/editor/dist/api';
import { I18n } from '@kie-tools-core/i18n/dist/core';
import * as KogitoVsCode from '@kie-tools-core/vscode-extension/dist';
import { getRedHatService, TelemetryService } from '@redhat-developer/vscode-redhat-telemetry';
import * as vscode from 'vscode';
import { KAOTO_FILE_PATH_GLOB } from '../helpers/helpers';
import { VSCodeKaotoChannelApiProducer } from './../webview/VSCodeKaotoChannelApiProducer';
import { ExtensionContextHandler } from './ExtensionContextHandler';
import { KaotoOutputChannel } from './KaotoOutputChannel';
import { PortManager } from '../helpers/PortManager';
import { CamelExecutorFactory } from '../executors/CamelExecutorFactory';
import { CamelLauncherDownloader } from '../services/CamelLauncherDownloader';
import { KaotoCatalogService } from '../services/KaotoCatalogService';
import { DEFAULT_CAMEL_VERSION } from '../constants';

let backendProxy: VsCodeBackendProxy;
let telemetryService: TelemetryService;

export async function activate(context: vscode.ExtensionContext) {
	KaotoOutputChannel.logInfo('Kaoto extension is alive.');

	// Initialize executor factory with extension context
	CamelExecutorFactory.initialize(context);

	const backendI18n = new I18n(backendI18nDefaults, backendI18nDictionaries, vscode.env.language);
	backendProxy = new VsCodeBackendProxy(context, backendI18n);

	const kieEditorStore = await KogitoVsCode.startExtension({
		extensionName: 'redhat.vscode-kaoto',
		context: context,
		viewType: 'webviewEditorsKaoto',
		editorEnvelopeLocator: new EditorEnvelopeLocator('vscode', [
			new EnvelopeMapping({
				type: 'kaoto',
				filePathGlob: KAOTO_FILE_PATH_GLOB,
				resourcesPathPrefix: 'dist/webview/editors/kaoto',
				envelopeContent: {
					type: EnvelopeContentType.PATH,
					path: 'dist/webview/KaotoEditorEnvelopeApp.js',
				},
			}),
		]),
		channelApiProducer: new VSCodeKaotoChannelApiProducer(),
		backendProxy: backendProxy,
	});

	const portManager = new PortManager();

	/*
	 * Initialize Camel Catalog Service
	 */
	const catalogService = new KaotoCatalogService(context);
	await catalogService.initialize();

	// Create and register status bar item
	const catalogStatusBar = catalogService.createStatusBarItem();
	context.subscriptions.push(catalogStatusBar);

	/*
	 * init Red Hat Telemetry
	 */
	const redhatService = await getRedHatService(context);
	telemetryService = await redhatService.getTelemetryService();

	const contextHandler = new ExtensionContextHandler(context, kieEditorStore, telemetryService);

	// Register configuration change listener for executor type
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(async (event) => {
			if (event.affectsConfiguration('kaoto.executor.type')) {
				KaotoOutputChannel.logInfo('Executor type configuration changed, validating requirements...');

				// Force re-initialization of executor with new type
				ensureExecutorAvailable(context, contextHandler, true).catch((error) => {
					KaotoOutputChannel.logError('Failed to initialize executor after catalog selection', error);
				});
			}
		}),
	);

	// Register catalog selection command with executor initialization
	// Must be registered after contextHandler is created
	context.subscriptions.push(
		vscode.commands.registerCommand('kaoto.selectCamelCatalog', async () => {
			const catalogSelected = await catalogService.showCatalogPicker();

			// Only trigger executor initialization if a catalog was actually selected
			if (catalogSelected) {
				// Trigger executor initialization in background after catalog selection
				// This ensures the new catalog version's executor (JAR/JBang) is downloaded if needed
				ensureExecutorAvailable(context, contextHandler, true).catch((error) => {
					KaotoOutputChannel.logError('Failed to initialize executor after catalog selection', error);
				});
			}
		}),
	);

	/*
	 * Ensure executor is available (non-blocking)
	 */
	ensureExecutorAvailable(context, contextHandler).catch((error) => {
		KaotoOutputChannel.logError('Background executor setup failed', error);
	});

	/*
	 * register undo/redo blank commands
	 */
	contextHandler.registerUndoRedoCommands();

	/*
	 * register commands for a toggle source code (open/close camel file in a side textual editor)
	 */
	await contextHandler.registerToggleSourceCode();

	/*
	 * register open with Kaoto Editor
	 */
	contextHandler.registerOpenWithKaoto();

	/*
	 * register all views (Integrations, Deployments, Tests, Help & Feedback, OpenAPI) first to avoid race conditions
	 */
	contextHandler.registerHelpAndFeedbackView();
	contextHandler.registerIntegrationsView();
	contextHandler.registerDeploymentsView(portManager);
	contextHandler.registerTestsView();
	contextHandler.registerOpenApiView();

	/*
	 * register commands for 'Integrations' view
	 */
	await contextHandler.hideIntegrationsViewButtonsForMavenProjects();
	contextHandler.registerNewCamelFilesCommands();
	contextHandler.registerNewCamelProjectCommands();
	contextHandler.registerKubernetesRunCommands();
	contextHandler.registerRunIntegrationCommands(portManager);
	contextHandler.registerRunSourceDirCommands(portManager);

	/*
	 * register commands for 'Deployments' view
	 */
	contextHandler.registerDeploymentsIntegrationCommands(); // Stop and Logs view item action buttons
	contextHandler.registerDeploymentsRouteCommands(); // Stop/Start/Resume/Suspend route level buttons

	/*
	 * register commands for 'OpenAPI' view
	 */
	contextHandler.registerOpenApiImportCommand();

	/*
	 * register commands for 'Tests' view
	 */
	contextHandler.registerTestsInitCommands();
	contextHandler.registerTestsRunCommands();

	/*
	 * send extension startup event into Red Hat Telemetry
	 */
	await telemetryService.sendStartupEvent();

	/*
	 * show recommended extensions
	 */
	await contextHandler.showRecommendedExtensions();

	/*
	 * Show What's New on first start for this version
	 */
	await contextHandler.showWhatsNewIfNeeded();

	KaotoOutputChannel.logInfo('Kaoto extension is successfully setup.');
	console.log('Kaoto extension is successfully setup.');
}

/**
 * Ensure executor is available and configured
 * Handles both JBang and Camel Launcher setup with status bar feedback
 * @param context - Extension context
 * @param contextHandler - Extension context handler
 * @param forceReinitialize - Force re-initialization even if executor is already available
 */
export async function ensureExecutorAvailable(
	context: vscode.ExtensionContext,
	contextHandler: ExtensionContextHandler,
	forceReinitialize: boolean = false,
): Promise<void> {
	try {
		// Reset executor cache if force re-initialization is requested
		if (forceReinitialize) {
			CamelExecutorFactory.resetExecutor();
			KaotoOutputChannel.logInfo('Executor cache reset for re-initialization');
		}

		const config = vscode.workspace.getConfiguration();
		const executorType = config.get<string>('kaoto.executor.type', 'jbang');

		if (executorType === 'jbang') {
			const jbang = await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Window,
					title: 'Kaoto: Preparing JBang',
					cancellable: false,
				},
				async (progress) => {
					KaotoOutputChannel.logInfo('Checking JBang availability...');
					progress.report({ message: 'Checking JBang on PATH...' });

					const resolvedJbang = await contextHandler.checkJbangOnPath();

					if (!resolvedJbang) {
						return undefined;
					}

					progress.report({ message: 'Configuring trusted JBang sources...' });
					await contextHandler.checkJBangTrustedSources();

					progress.report({ message: 'Verifying Camel JBang plugins...' });
					await contextHandler.checkCamelJBangPlugins();

					progress.report({ message: 'JBang is ready.' });
					return resolvedJbang;
				},
			);

			if (jbang) {
				KaotoOutputChannel.logInfo('JBang is ready');
				vscode.window.setStatusBarMessage('$(check) Kaoto: JBang ready', 3000);

				// Set executor available context for Camel JBang
				await contextHandler.setExecutorAvailable(true);
			} else {
				KaotoOutputChannel.logWarning('JBang not found on PATH');
				vscode.window.setStatusBarMessage('$(warning) Kaoto: JBang not found', 5000);

				// Disable/hide extension actions dependant on a Camel executor
				await contextHandler.setExecutorAvailable(false);
			}
		} else if (executorType === 'camel-launcher') {
			const catalogService = KaotoCatalogService.getInstance();
			const catalog = await catalogService.getSelectedIntegrationCatalog();
			const version = catalogService.getCamelVersionForCLI(catalog, 'camel-launcher') || DEFAULT_CAMEL_VERSION;
			const downloader = new CamelLauncherDownloader(context);

			const launcherPath = await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Window,
					title: `Kaoto: Preparing Camel Launcher ${version}`,
					cancellable: false,
				},
				async (progress) => {
					progress.report({ message: 'Downloading Camel Launcher and preparing scripts...' });
					KaotoOutputChannel.logInfo(`Downloading Camel Launcher ${version}...`);

					const resolvedLauncherPath = await downloader.ensureLauncher(version);

					progress.report({ message: 'Camel Launcher is ready.' });
					return resolvedLauncherPath;
				},
			);

			KaotoOutputChannel.logInfo(`Camel Launcher ${version} ready at: ${launcherPath}`);
			vscode.window.setStatusBarMessage('$(check) Kaoto: Camel Launcher ready', 3000);

			// Set executor available context for Camel Launcher
			await contextHandler.setExecutorAvailable(true);
		}
	} catch (error) {
		// Import LauncherNotFoundError type check
		const isLauncherNotFound = error instanceof Error && error.name === 'LauncherNotFoundError';

		if (isLauncherNotFound) {
			// User-friendly message for 404 errors
			const errorMessage = error instanceof Error ? error.message : String(error);
			KaotoOutputChannel.logWarning(errorMessage);
			vscode.window.showWarningMessage(errorMessage);
		} else {
			// Generic error handling for other failures
			const errorMessage = error instanceof Error ? error.message : String(error);
			KaotoOutputChannel.logError('Failed to setup executor', error);
			vscode.window.showWarningMessage(`Failed to setup executor: ${errorMessage}. It will be configured when first needed.`);
		}

		// Disable/hide extension actions dependant on a Camel executor
		await contextHandler.setExecutorAvailable(false);
	}
}

export async function deactivate() {
	backendProxy?.stopServices();
	await telemetryService.sendShutdownEvent();
	KaotoOutputChannel.dispose();
}
