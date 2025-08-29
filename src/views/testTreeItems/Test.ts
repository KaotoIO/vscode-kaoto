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
import { basename } from 'path';
import { TreeItem, TreeItemCollapsibleState, Uri, ThemeIcon } from 'vscode';

export class Test extends TreeItem {
	// Context values for standalone tests (not under maven project) - can be run
	private static readonly CONTEXT_TEST_FILE = 'citrus-test-file';

	// Context value for tests under maven project (inline run button hidden, cannot be run)
	private static readonly CONTEXT_TEST_FILE_MAVEN = 'citrus-test-file-maven';

	private readonly _isUnderMavenRoot: boolean;

	constructor(
		public readonly fileUri: Uri,
		isUnderMavenRoot: boolean = false,
	) {
		super(basename(fileUri.fsPath), TreeItemCollapsibleState.None);
		this._isUnderMavenRoot = isUnderMavenRoot;
		this.resourceUri = fileUri;
		this.tooltip = fileUri.fsPath;
		this.iconPath = new ThemeIcon('test-view-icon');
		this.command = { command: 'vscode.open', title: 'Open with Editor', arguments: [fileUri] };
		this.contextValue = isUnderMavenRoot ? Test.CONTEXT_TEST_FILE_MAVEN : Test.CONTEXT_TEST_FILE;
	}
}
