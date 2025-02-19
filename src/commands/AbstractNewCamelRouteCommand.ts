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
import { commands, Uri, window, workspace, WorkspaceFolder } from "vscode";
import { AbstractCamelCommand } from "./AbstractCamelCommand";
import { KaotoOutputChannel } from "../extension/KaotoOutputChannel";

export abstract class AbstractNewCamelRouteCommand extends AbstractCamelCommand {

	protected fileNameInputPrompt = 'Please provide a name for the new file (without extension).';

	protected async showInputBoxForFileName(targetFolder?: string): Promise<string> {
		const input = await window.showInputBox({
			prompt: this.fileNameInputPrompt,
			placeHolder: this.camelDSL?.placeHolder ?? '',
			validateInput: (fileName) => {
				return this.validateCamelFileName(fileName ?? '', targetFolder);
			},
		});
		return input ?? '';
	}

	protected async showDialogToPickFolder(defUri?: Uri): Promise<Uri | undefined> {
		const selectedFolders = await window.showOpenDialog(
			{
				canSelectMany: false,
				canSelectFolders: true,
				canSelectFiles: false,
				openLabel: 'Select',
				title: 'Select a folder to create the file in. ESC to cancel a file creation.',
				defaultUri: defUri || this.singleWorkspaceFolder?.uri
			});
		return selectedFolders ? selectedFolders[0] : undefined;
	}

	protected async showWorkspaceFolderPick(): Promise<WorkspaceFolder | undefined> {
		if (workspace.workspaceFolders && workspace.workspaceFolders.length > 1) {
			return await window.showWorkspaceFolderPick();
		}
		return undefined;
	}

	protected async showNoWorkspaceNotification(): Promise<void> {
		const warningMessage = 'Missing workspace context! This action requires an open workspace. Please add a folder or reopen a project.';
		KaotoOutputChannel.logWarning(warningMessage);
		const selection = await window.showWarningMessage(warningMessage, 'Open Folder');
		if (selection !== undefined) {
			await commands.executeCommand('vscode.openFolder');
		}
	}

	/**
	 * Waits until a file for a given vscode.Uri exists.
	 *
	 * @param fileUri the file URI to check.
	 * @param maxWaitMs maximum wait time in milliseconds (default: 5 seconds).
	 * @param delayMs initial delay time in milliseconds (default: 100ms).
	 * @returns a promise that resolves when the file exists or rejects when the timeout is reached.
	 */
	protected async waitForFileExists(fileUri: Uri, maxWaitMs: number = 5_000, delayMs: number = 100): Promise<void> {
		return new Promise((resolve, reject) => {
			const startTime = Date.now();
			const checkFile = async () => {
				try {
					await workspace.fs.stat(fileUri);
					resolve();
				} catch {
					if (Date.now() - startTime >= maxWaitMs) {
						reject(new Error(`File did not appear within ${maxWaitMs / 1000} seconds: ${fileUri.fsPath}`));
					} else {
						setTimeout(checkFile, delayMs);
					}
				}
			};
			checkFile();
		});
	}

}
