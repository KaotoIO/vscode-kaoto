/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License", destination); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Watches a file for changes made by external processes (e.g. git pull, AI edits) and
 * invokes a callback with the new content. Changes originating from VS Code's own save
 * are detected via onDidSaveTextDocument and suppressed to avoid unnecessary reloads.
 */
export class ExternalFileChangeWatcher implements vscode.Disposable {
	private readonly didSaveDisposable: vscode.Disposable;
	private readonly fileWatcher: vscode.FileSystemWatcher;
	private lastSelfSavedContent: string | undefined;
	private debounceTimer: NodeJS.Timeout | undefined;

	constructor(
		private readonly docUri: vscode.Uri,
		private readonly onExternalChange: (content: string) => Promise<void>,
		private readonly debounceMs: number = 300,
	) {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(docUri);
		const pattern = workspaceFolder
			? new vscode.RelativePattern(workspaceFolder, path.relative(workspaceFolder.uri.fsPath, docUri.fsPath))
			: new vscode.RelativePattern(path.dirname(docUri.fsPath), path.basename(docUri.fsPath));

		// When VS Code saves the document, capture the content that was written to disk.
		// The FileSystemWatcher will compare the on-disk content against this to determine
		// whether the change came from VS Code itself (self-save, skip) or an external process.
		this.didSaveDisposable = vscode.workspace.onDidSaveTextDocument((document) => {
			if (document.uri.toString() === docUri.toString()) {
				this.lastSelfSavedContent = document.getText();
			}
		});

		this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
		this.fileWatcher.onDidChange(() => {
			if (this.debounceTimer) {
				clearTimeout(this.debounceTimer);
			}
			this.debounceTimer = setTimeout(() => {
				this.debounceTimer = undefined;
				void this.handleFileChange();
			}, this.debounceMs);
		});
	}

	private async handleFileChange(): Promise<void> {
		const content = await fs.readFile(this.docUri.fsPath, 'utf8');
		// If this content matches what VS Code just saved, the file change originated from
		// VS Code itself — no need to reload the editor.
		if (this.lastSelfSavedContent !== undefined && this.lastSelfSavedContent === content) {
			this.lastSelfSavedContent = undefined;
			return;
		}
		this.lastSelfSavedContent = undefined;
		await this.onExternalChange(content);
	}

	dispose(): void {
		this.fileWatcher.dispose();
		this.didSaveDisposable.dispose();
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = undefined;
		}
	}
}
