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

import { waitUntil } from 'async-wait-until';
import { backendI18nDefaults, backendI18nDictionaries } from "@kie-tools-core/backend/dist/i18n";
import { VsCodeBackendProxy } from "@kie-tools-core/backend/dist/vscode";
import { EditorEnvelopeLocator, EnvelopeContentType, EnvelopeMapping } from "@kie-tools-core/editor/dist/api";
import { I18n } from "@kie-tools-core/i18n/dist/core";
import * as KogitoVsCode from "@kie-tools-core/vscode-extension";
import { getRedHatService, TelemetryService } from "@redhat-developer/vscode-redhat-telemetry";
import * as vscode from "vscode";
import * as child_process from "child_process";
import * as os from 'os';
import * as path from 'path';
import { TextDecoder } from 'util';

let backendProxy: VsCodeBackendProxy;
let telemetryService: TelemetryService;

let backendProcess: child_process.ChildProcessWithoutNullStreams | undefined;
let kaotoBackendOutputChannel: vscode.OutputChannel | undefined;
let kaotoBackendWarmedUp: boolean = false;
export let kaotoBackendPort :string;

export async function activate(context: vscode.ExtensionContext) {
  console.info("Kaoto Editor extension is alive.");

  await warmupKaotoBackend();

  const backendI18n = new I18n(backendI18nDefaults, backendI18nDictionaries, vscode.env.language);
  backendProxy = new VsCodeBackendProxy(context, backendI18n);

  KogitoVsCode.startExtension({
    extensionName: "redhat.vscode-kaoto",
    context: context,
    viewType: "webviewEditorsKaoto",
    editorEnvelopeLocator: new EditorEnvelopeLocator("vscode", [
      new EnvelopeMapping({
        type: "kaoto",
        filePathGlob: "**/**(.+(kaoto|camel)).+(yml|yaml)",
        resourcesPathPrefix: "dist/webview/editors/kaoto",
        envelopeContent: {
          type: EnvelopeContentType.PATH,
          path: "dist/webview/KaotoEditorEnvelopeApp.js"
        }
      }),
    ]),
    backendProxy: backendProxy,
  });

  vscode.commands.registerCommand('kaoto.open', (uri: vscode.Uri) => {
    vscode.commands.executeCommand('vscode.openWith', uri, 'webviewEditorsKaoto');
  });
  
  const redhatService = await getRedHatService(context);  
  telemetryService = await redhatService.getTelemetryService();
  telemetryService.sendStartupEvent();

  async function warmupKaotoBackend() {
    kaotoBackendOutputChannel = vscode.window.createOutputChannel(`Kaoto backend`);
    const nativeExecutable = context.asAbsolutePath(path.join("binaries", getBinaryName()));
    backendProcess = child_process.spawn(nativeExecutable, ['-Dquarkus.http.port=0']);
    backendProcess.on("close", (code, _signal) => {
      if (kaotoBackendOutputChannel) {
        kaotoBackendOutputChannel.append(`Kaoto backend process closed with code: ${code}\n`);
      }
    });
    backendProcess.stdout.on("error", function (error) {
      if (kaotoBackendOutputChannel) {
        kaotoBackendOutputChannel.append(`Failed to start Kaoto backend ${error.name} ${error.message}\n`);
      }
    });
    backendProcess.stderr.on("error", function (error) {
      if (kaotoBackendOutputChannel) {
        kaotoBackendOutputChannel.append(`Error: ${error.name} ${error.message}\n`);
      }
    });
    backendProcess.stdout.on("data", function (data) {
      const dec = new TextDecoder("utf-8");
      const text = dec.decode(data);
      if (!kaotoBackendWarmedUp && text.includes('Catalog class io.kaoto.backend.api.metadata.catalog.StepCatalog_Subclass warmed up in')) {
        kaotoBackendWarmedUp = true;
      }
      const suffixForListeningPort = 'Listening on: http://0.0.0.0:';
      if (kaotoBackendPort === undefined && text.includes(suffixForListeningPort)) {
        const textStartingWithPort = text.substring(text.indexOf(suffixForListeningPort) + suffixForListeningPort.length);
        kaotoBackendPort = textStartingWithPort.substring(0, textStartingWithPort.indexOf('\n'));
      }
      if (kaotoBackendOutputChannel) {
        kaotoBackendOutputChannel.append(text);
      }
    });
    backendProcess.stderr.on("data", function (data) {
      if (kaotoBackendOutputChannel) {
        const dec = new TextDecoder("utf-8");
        const text = dec.decode(data);
        kaotoBackendOutputChannel.append(`Error: ` + text);
      }
    });

    try {
      await waitUntil(() => kaotoBackendWarmedUp, { timeout: 60000 });
    } catch {
      kaotoBackendOutputChannel.append('Kaoto backend failed to warm up in 1 minute.\n');
    }
  }
}

function getBinaryName(): string {
	if (os.platform() === "darwin") {
		return "kaoto-macos-amd64";
	} else if(os.platform() === 'win32') {
		return "kaoto-windows-amd64.exe";
	}
	return "kaoto-linux-amd64";
}

export function deactivate() {
  kaotoBackendWarmedUp = false;
  if (backendProcess !== undefined) {
    if (kaotoBackendOutputChannel !== undefined) {
      kaotoBackendOutputChannel.append(`Kaoto backend is stopped during VS Code extension deactivation.`);
    }
    backendProcess.kill();
  }
  backendProxy?.stopServices();
  
  if (kaotoBackendOutputChannel != undefined) {
    kaotoBackendOutputChannel.dispose();
    kaotoBackendOutputChannel = undefined;
  }
  telemetryService.sendShutdownEvent();
}
