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
import { EditorEnvelopeLocator, EnvelopeMapping } from "@kie-tools-core/editor/dist/api";
import { I18n } from "@kie-tools-core/i18n/dist/core";
import * as KogitoVsCode from "@kie-tools-core/vscode-extension";
import { getRedHatService, TelemetryService } from "@redhat-developer/vscode-redhat-telemetry";
import * as vscode from "vscode";
// import * as child_process from "child_process";

let backendProxy: VsCodeBackendProxy;
let telemetryService: TelemetryService;

// const LENGTH_OF_DOCKER_CONTAINER_ID = 63;
// let dockerContainerID: string | undefined;

console.info({ VSCODE_ENV: vscode.env.uiKind });

export async function activate(context: vscode.ExtensionContext) {
  console.info("Kaoto Editor extension is alive.");

  // const kaotoBackendOutputChannel = vscode.window.createOutputChannel(`Kaoto backend`);
  // const backendProcess = child_process.spawnSync("docker", ["run", "--rm", "-d", "-p", "8081:8081", "kaotoio/backend:main"]);
  // handlePotentialErrorOnKaotoBackendStart(backendProcess, kaotoBackendOutputChannel);
  // const filteredOutput = backendProcess.output.filter((s) => {
  //     return s !== undefined && s !== null && s.length > LENGTH_OF_DOCKER_CONTAINER_ID;
  //   });
  // const dockerContainerIDLine = filteredOutput[filteredOutput.length - 1];
  // dockerContainerID = dockerContainerIDLine?.toString().replace(/(\r\n|\n|\r)/gm, "");

  // backendProcess.output.forEach((value: Buffer | null) => value && kaotoBackendOutputChannel.appendLine(value.toString()));

  const backendI18n = new I18n(backendI18nDefaults, backendI18nDictionaries, vscode.env.language);
  backendProxy = new VsCodeBackendProxy(context, backendI18n);

  KogitoVsCode.startExtension({
    extensionName: "redhat.vscode-kaoto",
    context: context,
    viewType: "webviewEditorsKaoto",
    editorEnvelopeLocator: new EditorEnvelopeLocator("vscode", [
      new EnvelopeMapping({
        type: "kaoto",
        filePathGlob: "**/*.kaoto.+(yml|yaml)",
        resourcesPathPrefix: "dist/webview/editors/kaoto",
        envelopePath: "dist/webview/KaotoEditorEnvelopeApp.js",
      }),
    ]),
    backendProxy: backendProxy,
  });

  console.info("Extension is successfully setup.");
  
  const redhatService = await getRedHatService(context);  
  telemetryService = await redhatService.getTelemetryService();
  telemetryService.sendStartupEvent();
}

// function handlePotentialErrorOnKaotoBackendStart(backendProcess: child_process.SpawnSyncReturns<Buffer>, kaotoBackendOutputChannel: vscode.OutputChannel) {
// 	if (backendProcess.error) {
// 		kaotoBackendOutputChannel.appendLine(backendProcess.error.message);
// 		if (backendProcess.error.stack) {
// 			kaotoBackendOutputChannel.appendLine(backendProcess.error.stack?.toString());
// 		}
// 		if (backendProcess.stderr) {
// 			kaotoBackendOutputChannel.appendLine(backendProcess.stderr.toString('utf-8'));
// 		}
// 		if (backendProcess.stdout) {
// 			kaotoBackendOutputChannel.appendLine(backendProcess.stdout.toString('utf-8'));
// 		}
// 		if (backendProcess.output) {
// 			kaotoBackendOutputChannel.appendLine(backendProcess.output.toString());
// 		}
// 		throw new Error(
// 			`Cannot activate the extension because the Kaoto backend cannot be launched.
// 		Failed to start the Kaoto backend. See output named "Kaoto backend" for more details.
// 		A common issue is that docker command is not available in system path.`);
// 	}
// }

export function deactivate() {
  // if (dockerContainerID !== undefined) {
  //   child_process.spawnSync("docker", ["stop", dockerContainerID]);
  // }
  backendProxy?.stopServices();
  
  telemetryService.sendShutdownEvent();
}
