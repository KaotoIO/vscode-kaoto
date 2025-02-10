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
import * as vscode from "vscode";
import * as KogitoVsCode from "@kie-tools-core/vscode-extension/dist";
import { HelpFeedbackProvider } from "../views/providers/HelpFeedbackProvider";

export class ExtensionContextHandler {

    protected kieEditorStore: KogitoVsCode.VsCodeKieEditorStore;
    protected context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext, kieEditorStore: KogitoVsCode.VsCodeKieEditorStore) {
        this.kieEditorStore = kieEditorStore;
        this.context = context;
    }

    public async registerToggleSourceCode() {
        this.context.subscriptions.push(vscode.commands.registerCommand('kaoto.open.source', async () => {
            if (this.kieEditorStore.activeEditor !== undefined) {
                const doc = await vscode.workspace.openTextDocument(this.kieEditorStore.activeEditor?.document.document.uri);
                await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            }
        }));
        this.context.subscriptions.push(vscode.commands.registerCommand('kaoto.close.source', async () => {
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }));
    }

    public registerOpenWithKaoto() {
        this.context.subscriptions.push(vscode.commands.registerCommand('kaoto.open', (uri: vscode.Uri) => {
            vscode.commands.executeCommand('vscode.openWith', uri, 'webviewEditorsKaoto');
        }));
    }

    public registerHelpAndFeedbackView() {
        this.context.subscriptions.push(vscode.window.registerTreeDataProvider('kaoto.help', new HelpFeedbackProvider()));
    }
}