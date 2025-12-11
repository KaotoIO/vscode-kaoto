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

let backendProxy: VsCodeBackendProxy;
let telemetryService: TelemetryService;

export async function activate(context: vscode.ExtensionContext) {
	KaotoOutputChannel.logInfo('Kaoto extension is alive.');

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
	 * init Red Hat Telemetry
	 */
	const redhatService = await getRedHatService(context);
	telemetryService = await redhatService.getTelemetryService();

	const contextHandler = new ExtensionContextHandler(context, kieEditorStore, telemetryService);

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
	 * register 'Integrations' view provider
	 */
	contextHandler.registerIntegrationsView();
	await contextHandler.hideIntegrationsViewButtonsForMavenProjects();
	contextHandler.registerNewCamelFilesCommands();
	contextHandler.registerNewCamelProjectCommands();
	contextHandler.registerKubernetesRunCommands();
	contextHandler.registerRunIntegrationCommands(portManager);
	contextHandler.registerRunSourceDirCommands(portManager);

	/*
	 * register 'Deployments' view provider
	 */
	contextHandler.registerDeploymentsView(portManager);

	/*
	 * register 'Help & Feedback' view provider
	 */
	contextHandler.registerHelpAndFeedbackView();

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

	/*
	 * check JBang is available on a system PATH
	 */
	const jbang = await contextHandler.checkJbangOnPath();

	/*
	 * check Apache Camel Trusted Source is configured
	 */
	if (jbang) {
		await contextHandler.checkCamelJbangTrustedSource();
	}

	KaotoOutputChannel.logInfo('Kaoto extension is successfully setup.');
}

export async function deactivate() {
	backendProxy?.stopServices();
	await telemetryService.sendShutdownEvent();
	KaotoOutputChannel.dispose();
}
