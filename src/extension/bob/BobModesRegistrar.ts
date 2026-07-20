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
import { COMMAND_BOB_MODES_CREATE, COMMAND_BOB_MODES_REFRESH, COMMAND_BOB_MODES_SHOW_SOURCE, COMMAND_BOB_MODES_TRY, VIEW_BOB_MODES } from '../../constants';
import { BobModeItem } from './BobModeItem';
import { BobModesProvider } from './BobModesProvider';
import { tryBobMode } from './BobChatUtils';
import { BobModeCodeLensProvider } from './BobModeCodeLensProvider';

const BOB_MODES_FILE_TEMPLATE = [
	'customModes:',
	'  - slug: my-custom-mode',
	'    name: My Custom Mode',
	'    description: Describe what this mode does',
	'    roleDefinition: "Define the AI\'s role and expertise"',
	'    whenToUse: Describe when this mode should be used',
	'    customInstructions: ""',
	'    groups: []',
].join('\n');

export function registerBobModes(context: vscode.ExtensionContext): void {
	const provider = new BobModesProvider();

	const treeView = vscode.window.createTreeView(VIEW_BOB_MODES, {
		treeDataProvider: provider,
		showCollapseAll: false,
	});

	const dispose = { dispose: () => provider.dispose() };

	const refreshCmd = vscode.commands.registerCommand(COMMAND_BOB_MODES_REFRESH, () => provider.refresh());

	const showSourceCmd = vscode.commands.registerCommand(COMMAND_BOB_MODES_SHOW_SOURCE, async (item: BobModeItem) => {
		const doc = await vscode.workspace.openTextDocument(item.fileUri);
		await vscode.window.showTextDocument(doc, {
			selection: new vscode.Range(new vscode.Position(item.line, 0), new vscode.Position(item.line, 0)),
		});
	});

	const tryCmd = vscode.commands.registerCommand(COMMAND_BOB_MODES_TRY, (item: BobModeItem) => tryBobMode(item.slug, item.label as string));

	const createCmd = vscode.commands.registerCommand(COMMAND_BOB_MODES_CREATE, async () => {
		const wsFolders = vscode.workspace.workspaceFolders;
		if (!wsFolders?.length) {
			return;
		}

		const bobDir = vscode.Uri.joinPath(wsFolders[0].uri, '.bob');
		const targetUri = vscode.Uri.joinPath(bobDir, 'custom_modes.yaml');

		const yamlExists = await vscode.workspace.fs.stat(targetUri).then(
			() => true,
			() => false,
		);

		if (!yamlExists) {
			await vscode.workspace.fs.createDirectory(bobDir);
			await vscode.workspace.fs.writeFile(targetUri, new TextEncoder().encode(BOB_MODES_FILE_TEMPLATE));
		}

		await vscode.commands.executeCommand('vscode.openWith', targetUri, 'webviewEditorsKaoto');
		provider.refresh();
	});

	const codeLensProvider = vscode.languages.registerCodeLensProvider(
		{ scheme: 'file', language: 'yaml', pattern: '**/.bob/custom_modes.yaml' },
		new BobModeCodeLensProvider(),
	);

	context.subscriptions.push(treeView, dispose, refreshCmd, showSourceCmd, tryCmd, createCmd, codeLensProvider);
}
