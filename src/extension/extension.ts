/*
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
import { getRedHatService, TelemetryService } from "@redhat-developer/vscode-redhat-telemetry";
import * as vscode from "vscode";
import { KAOTO_FILE_PATH_GLOB } from "./helpers";
import { VSCodeKaotoChannelApiProducer } from './../webview/VSCodeKaotoChannelApiProducer';

let backendProxy: VsCodeBackendProxy;
let telemetryService: TelemetryService;

export async function activate(context: vscode.ExtensionContext) {
  console.info("Kaoto extension is alive.");

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

  vscode.commands.registerCommand('kaoto.open.source', async() => {
    if (kieEditorStore.activeEditor !== undefined) {
      const doc = await vscode.workspace.openTextDocument(kieEditorStore.activeEditor?.document.document.uri);
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    }
  });

  vscode.commands.registerCommand('kaoto.open', (uri: vscode.Uri) => {
    vscode.commands.executeCommand('vscode.openWith', uri, 'webviewEditorsKaoto');
  });

  const redhatService = await getRedHatService(context);
  telemetryService = await redhatService.getTelemetryService();
  telemetryService.sendStartupEvent();
}

export function deactivate() {
  backendProxy?.stopServices();
  telemetryService.sendShutdownEvent();
}
