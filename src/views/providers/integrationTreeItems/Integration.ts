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
import { dirname, relative } from 'path';
import { TreeItem, Uri, TreeItemCollapsibleState, IconPath, workspace } from 'vscode';

export class Integration extends TreeItem {
	constructor(
		public readonly name: string,
		public readonly filename: string,
		public readonly filepath: Uri,
		public collapsibleState: TreeItemCollapsibleState,
		public readonly type: string,
		public readonly icon: string | IconPath,
	) {
		super(filename, collapsibleState);
		this.iconPath = icon;
		this.tooltip = this.filepath.fsPath;
		this.description = this.getDescription(filepath);
	}

	command = { command: 'kaoto.open', title: 'Open with Kaoto', arguments: [this.filepath] };

	contextValue = 'integration';

	private getDescription(filepath: Uri): string {
		if (workspace.workspaceFolders && workspace.workspaceFolders.length > 1) {
			return dirname(relative(dirname(workspace.getWorkspaceFolder(filepath)?.uri.fsPath as string), filepath.fsPath));
		} else {
			return dirname(relative(workspace.getWorkspaceFolder(filepath)?.uri.fsPath as string, filepath.fsPath));
		}
	}
}
