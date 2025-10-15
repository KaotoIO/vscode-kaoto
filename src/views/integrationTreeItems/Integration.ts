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
import { TreeItem, Uri, TreeItemCollapsibleState, IconPath } from 'vscode';

export class Integration extends TreeItem {
	constructor(
		public readonly name: string,
		public readonly filename: string,
		public readonly filepath: Uri,
		public collapsibleState: TreeItemCollapsibleState,
		public readonly type: string,
		public readonly dsl: string,
		public readonly icon: string | IconPath,
		public readonly description: string,
		public readonly isUnderMavenRoot: boolean = false,
		public readonly isTopLevelWithinWorkspace: boolean = true,
	) {
		super(filename, collapsibleState);
		this.iconPath = icon;
		this.description = description;
		this.tooltip = this.filepath.fsPath;

		const toplevel = isTopLevelWithinWorkspace ? 'integration' : 'integration-standalone-child';
		const mavenChild = isUnderMavenRoot ? 'integration-maven-child' : toplevel;
		this.contextValue = mavenChild;
	}

	command = { command: 'kaoto.open', title: 'Open with Kaoto', arguments: [this.filepath] };
}
