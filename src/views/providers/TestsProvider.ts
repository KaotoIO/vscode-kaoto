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
import { commands, RelativePattern, TreeItem, TreeItemCollapsibleState, Uri, workspace } from 'vscode';
import { AbstractFolderTreeProvider } from './AbstractFolderTreeProvider';
import { Test } from '../testTreeItems/Test';
import { TestFolder } from '../testTreeItems/TestFolder';
import { basename } from 'path';

export class TestsProvider extends AbstractFolderTreeProvider<TestFolder> {
	public readonly VIEW_ITEM_SHOW_SOURCE_COMMAND_ID: string = 'kaoto.tests.showSource';
	public readonly VIEW_ITEM_DELETE_COMMAND_ID: string = 'kaoto.tests.delete';

	private static readonly FILE_PATTERN = '{**/*.test.yaml,**/*.citrus.yaml,**/jbang.properties}';
	private static readonly TEST_FILE_PATTERN = '{**/*.test.yaml,**/*.citrus.yaml}';

	/** Cache of file paths to Test items for efficient lookup and single-item refresh */
	private readonly testItemCache: Map<string, Test> = new Map();

	constructor() {
		super();
		this.initFileWatcher();
	}

	protected getFilePattern(): string {
		return TestsProvider.FILE_PATTERN;
	}

	protected getExcludePattern(): string {
		return TestsProvider.EXCLUDE_PATTERN;
	}

	protected createFolderItem(name: string, folderUri: Uri, isUnderMavenRoot: boolean, isMavenRoot: boolean, isWorkspaceRoot: boolean = false): TestFolder {
		return new TestFolder(name, folderUri, isUnderMavenRoot, isMavenRoot, isWorkspaceRoot);
	}

	protected async toTreeItemForFile(file: Uri, isUnderMavenRoot: boolean, _isTopLevelWithinWorkspace: boolean): Promise<TreeItem> {
		const fileName = basename(file.fsPath);

		// Handle jbang.properties files - simple tree item with default icon
		if (fileName === 'jbang.properties') {
			const item = new TreeItem(fileName, TreeItemCollapsibleState.None);
			item.resourceUri = file;
			item.tooltip = file.fsPath;
			item.command = { command: 'vscode.open', title: 'Open File', arguments: [file] };
			item.contextValue = 'jbang-properties-file';
			return item;
		}

		// Check if we have a cached item for this file
		const cachedTest = this.testItemCache.get(file.fsPath);
		if (cachedTest) {
			return cachedTest;
		}

		// Create new test item and cache it
		const test = new Test(file, isUnderMavenRoot);

		this.testItemCache.set(file.fsPath, test);
		return test;
	}

	protected isFolderItem(element: TreeItem): element is TestFolder {
		return element instanceof TestFolder;
	}

	protected setContext(hasFiles: boolean): void {
		commands.executeCommand('setContext', 'kaoto.testExists', hasFiles);
	}

	/**
	 * Override refresh to clear all caches when a full refresh is triggered
	 * Note: test results are preserved to maintain pass/fail status
	 */
	refresh(): void {
		this.testItemCache.clear();
		this.invalidateCache();
		super.refresh();
	}

	/**
	 * Remove a specific file from all caches (used when a file is deleted)
	 * @param filePath The file path to remove from caches
	 */
	removeFromCache(filePath: string): void {
		this.testItemCache.delete(filePath);
	}

	/**
	 * Refresh a specific test item
	 * @param test The test item to refresh
	 */
	refreshItem(test: Test): void {
		this.refreshImmediate(test);
	}

	/**
	 * Find all test files under a specific folder path (excludes jbang.properties)
	 * @param folderPath The folder path to search in
	 * @returns Array of test file paths
	 */
	async getTestFilesInFolder(folderPath: string): Promise<string[]> {
		const folderUri = Uri.file(folderPath);
		// Use TEST_FILE_PATTERN to only get actual test files, not jbang.properties
		const pattern = new RelativePattern(folderUri, TestsProvider.TEST_FILE_PATTERN);
		const files = await workspace.findFiles(pattern, this.getExcludePattern());
		return files.map((file) => file.fsPath);
	}
}
