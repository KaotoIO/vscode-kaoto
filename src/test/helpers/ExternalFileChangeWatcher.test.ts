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
import { assert } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { waitUntil } from 'async-wait-until';
import { ExternalFileChangeWatcher } from '../../helpers/ExternalFileChangeWatcher';

const DEBOUNCE_MS = 10;
const NEGATIVE_WAIT_MS = 100; // must exceed DEBOUNCE_MS + OS notification delay

suite('ExternalFileChangeWatcher', function () {
	this.timeout(15_000);

	let tmpFile: string;
	let tmpUri: vscode.Uri;
	let watcher: ExternalFileChangeWatcher | undefined;

	setup(async () => {
		// Use the workspace folder so VS Code's FileSystemWatcher reliably detects changes.
		// Files in os.tmpdir() are outside the workspace and may not be watched on all platforms.
		const workspaceFolder = vscode.workspace.workspaceFolders![0];
		tmpFile = path.join(workspaceFolder.uri.fsPath, `kaoto-test-${Date.now()}.camel.yaml`);
		fs.writeFileSync(tmpFile, 'initial content');
		tmpUri = vscode.Uri.file(tmpFile);
		watcher = undefined;
	});

	teardown(async () => {
		watcher?.dispose();
		if (fs.existsSync(tmpFile)) {
			fs.unlinkSync(tmpFile);
		}
	});

	test('calls onExternalChange when the file is modified by an external process', async () => {
		const receivedContents: string[] = [];
		watcher = new ExternalFileChangeWatcher(
			tmpUri,
			async (content) => {
				receivedContents.push(content);
			},
			DEBOUNCE_MS,
		);

		// Allow the FileSystemWatcher to finish initialising before writing.
		// Without this pause the write can race ahead of the watcher startup.
		await new Promise((resolve) => setTimeout(resolve, 100));

		fs.writeFileSync(tmpFile, 'externally changed content');

		await waitUntil(() => receivedContents.length > 0, { timeout: 10_000, intervalBetweenAttempts: 100 });

		assert.deepEqual(receivedContents, ['externally changed content']);
	});

	test('does not call onExternalChange for a VS Code save but does for a subsequent external change', async () => {
		// Open the file as a VS Code text document so we can save it through VS Code,
		// which will fire onDidSaveTextDocument with the saved content.
		const document = await vscode.workspace.openTextDocument(tmpUri);
		await vscode.window.showTextDocument(document);

		const edit = new vscode.WorkspaceEdit();
		edit.replace(tmpUri, new vscode.Range(0, 0, document.lineCount, 0), 'vs code saved content');
		await vscode.workspace.applyEdit(edit);

		const receivedContents: string[] = [];
		watcher = new ExternalFileChangeWatcher(
			tmpUri,
			async (content) => {
				receivedContents.push(content);
			},
			DEBOUNCE_MS,
		);

		// Save through VS Code, then immediately write different content externally.
		// If the self-save were not suppressed we'd receive two calls or the wrong content.
		// Waiting for exactly one call with the external content proves both behaviours.
		await document.save();
		fs.writeFileSync(tmpFile, 'external change after save');

		await waitUntil(() => receivedContents.length > 0, { timeout: 10_000, intervalBetweenAttempts: 100 });

		assert.deepEqual(receivedContents, ['external change after save']);
	});

	test('does not call onExternalChange after dispose', async () => {
		const receivedContents: string[] = [];
		watcher = new ExternalFileChangeWatcher(
			tmpUri,
			async (content) => {
				receivedContents.push(content);
			},
			DEBOUNCE_MS,
		);

		watcher.dispose();
		watcher = undefined;

		fs.writeFileSync(tmpFile, 'change after dispose');

		await new Promise((resolve) => setTimeout(resolve, NEGATIVE_WAIT_MS));
		assert.isEmpty(receivedContents, 'onExternalChange should not be called after dispose');
	});
});
