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
import { existsSync } from 'fs';
import * as vscode from 'vscode';
import {
	COMMAND_BOB_MODES_CONVERT,
	COMMAND_BOB_MODES_CONVERT_SINGLE,
	COMMAND_BOB_MODES_CREATE,
	COMMAND_BOB_MODES_REFRESH,
	COMMAND_BOB_MODES_SHOW_SOURCE,
	COMMAND_BOB_MODES_TRY,
	CONTEXT_BOB_MODES_FILE_EXISTS,
	VIEW_BOB_MODES,
} from '../../constants';
import { BobModeItem } from './BobModeItem';
import { BobModesProvider } from './BobModesProvider';
import { tryBobMode } from './BobChatUtils';
import { convertModeToKaotoFormat, readModeSlugs } from './BobModeConverter';
/**
 * Default file content written by `kaoto.bobModes.create`.
 *
 * Uses the folded scalar (`>`) style for `customInstructions`, which is what
 * the Kaoto designer itself produces. Key folded-scalar rules that must hold:
 *   - A blank line between two content lines preserves a real \n in the value.
 *   - Two consecutive blank lines produce a paragraph break (\n\n).
 *   - A line containing only spaces (the step-body indent line) preserves a \n
 *     followed by those spaces — built programmatically below so no editor can
 *     strip the trailing whitespace.
 *
 * Body indent is 6 spaces (4-space list-item depth + 2-space key depth).
 */
function buildFileTemplate(): string {
	// The step body indent line: 6 spaces (scalar base) + 3 spaces (list continuation)
	// = "         " — must be built in code; editors strip trailing spaces in literals.
	const stepBodyIndentLine = ' '.repeat(9);

	return [
		'customModes:',
		'  - slug: new-mode',
		'    name: New Mode',
		'    description: Describe what this mode does',
		"    roleDefinition: Define the AI's role and expertise",
		'    whenToUse: Describe when this mode should be used',
		'    customInstructions: >',
		'      system instructions:',
		'',
		'      Follow the below instructions strictly. These directives are mandatory and',
		'      non-negotiable.',
		'',
		'      - You MUST call switch_mode AND spawn_subagent as actual tool calls for',
		'      EVERY specialist step. Performing the specialist work yourself inline is',
		'      STRICTLY FORBIDDEN.',
		'',
		"      - For each specialist step: (1) call switch_mode with the stage's mode_id,",
		'      then (2) immediately call spawn_subagent with a self-contained description',
		"      that includes the target mode's role and the exact JSON payload verbatim.",
		'',
		'      - The spawn_subagent description MUST start with: "You are running as the',
		'      <mode name> stage of the pipeline. Your input payload is:" followed by the',
		'      raw JSON block. Set fork_context: false.',
		'',
		"      - Collect the subagent's output as the $RESULT variable for that step",
		'      before proceeding. Never fabricate or infer subagent output — wait for the',
		'      actual tool response.',
		'',
		'      - Never skip either tool call. If a step requires both, both must be',
		'      issued as real tool invocations before moving to the next step.',
		'',
		'',
		'      1. First step',
		stepBodyIndentLine,
		'         - Describe what this step does',
		'',
		'      > Hard rules',
		'',
		'      > - Do not invent content not present in the input.',
		'',
		'      > - Follow the output format specified in the final step exactly.',
		'    groups:',
		'      - read',
	].join('\n');
}

const BOB_MODES_FILE_TEMPLATE = buildFileTemplate();

/** Sets the `kaoto.bobModesFileExists` context key based on whether the file is present. */
function updateFileExistsContext(wsFolders: readonly vscode.WorkspaceFolder[] | undefined): void {
	const exists = !!wsFolders?.length && existsSync(vscode.Uri.joinPath(wsFolders[0].uri, '.bob', 'custom_modes.yaml').fsPath);
	void vscode.commands.executeCommand('setContext', CONTEXT_BOB_MODES_FILE_EXISTS, exists);
}

export function registerBobModes(context: vscode.ExtensionContext): void {
	const provider = new BobModesProvider();

	// Set initial context and keep it in sync whenever the file or its parent
	// directory is created or deleted. A separate watcher on the .bob directory
	// is needed because VS Code's file watcher does not fire for the file when
	// the parent directory is removed.
	updateFileExistsContext(vscode.workspace.workspaceFolders);
	const update = () => updateFileExistsContext(vscode.workspace.workspaceFolders);
	const fileWatcher = vscode.workspace.createFileSystemWatcher('**/.bob/custom_modes.yaml');
	fileWatcher.onDidCreate(update);
	fileWatcher.onDidDelete(update);
	const dirWatcher = vscode.workspace.createFileSystemWatcher('**/.bob');
	dirWatcher.onDidDelete(update);

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

		// Always write the template. This command is only reachable via the welcome-view
		// button, which VS Code hides as soon as the tree has items. So if this command
		// runs, the file either does not exist or contains no valid modes — either way
		// it is safe to (re)create it with the default template.
		await vscode.workspace.fs.createDirectory(bobDir);
		await vscode.workspace.fs.writeFile(targetUri, new TextEncoder().encode(BOB_MODES_FILE_TEMPLATE));

		await vscode.commands.executeCommand('vscode.openWith', targetUri, 'webviewEditorsKaoto');
		provider.refresh();
	});

	// view/title $(wand) button — opens QuickPick multi-select of all modes
	const convertCmd = vscode.commands.registerCommand(COMMAND_BOB_MODES_CONVERT, async () => {
		const wsFolders = vscode.workspace.workspaceFolders;
		if (!wsFolders?.length) {
			return;
		}
		const fileUri = vscode.Uri.joinPath(wsFolders[0].uri, '.bob', 'custom_modes.yaml');
		const entries = readModeSlugs(fileUri.fsPath);

		if (entries.length === 0) {
			void vscode.window.showWarningMessage('No modes found in custom_modes.yaml.');
			return;
		}

		// Build QuickPick items — all pre-selected
		const picks = await vscode.window.showQuickPick(
			entries.map((e) => ({ label: e.name, description: e.slug, picked: true })),
			{
				title: 'Convert to Kaoto Format — select modes to convert',
				canPickMany: true,
				placeHolder: 'Select one or more modes (all selected by default)',
			},
		);

		// User cancelled
		if (!picks) {
			return;
		}

		const selectedSlugs = picks.map((p) => p.description as string);
		// Empty selection means user de-selected everything — treat as cancel
		if (selectedSlugs.length === 0) {
			void vscode.window.showWarningMessage('No modes selected. Conversion cancelled.');
			return;
		}

		// If every mode is selected, pass undefined so the prompt says "ALL modes"
		const slugsArg = selectedSlugs.length === entries.length ? undefined : selectedSlugs;
		await convertModeToKaotoFormat({ slugs: slugsArg, fileUri });
	});

	// view/item/context right-click — converts a single mode directly, no picker
	const convertSingleCmd = vscode.commands.registerCommand(COMMAND_BOB_MODES_CONVERT_SINGLE, async (item: BobModeItem) => {
		const wsFolders = vscode.workspace.workspaceFolders;
		const fileUri = wsFolders?.length ? vscode.Uri.joinPath(wsFolders[0].uri, '.bob', 'custom_modes.yaml') : item.fileUri;
		await convertModeToKaotoFormat({ slugs: [item.slug], fileUri });
	});

	context.subscriptions.push(treeView, fileWatcher, dirWatcher, dispose, refreshCmd, showSourceCmd, tryCmd, createCmd, convertCmd, convertSingleCmd);
}
