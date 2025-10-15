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
import { ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';

export class Folder extends TreeItem {
	constructor(
		public readonly labelName: string,
		public readonly folderUri: Uri,
		public readonly tooltipText?: string,
		public readonly isUnderMavenRoot: boolean = false,
		public readonly isMavenRoot: boolean = false,
	) {
		super(labelName, TreeItemCollapsibleState.Collapsed);
		this.resourceUri = folderUri;
		this.tooltip = tooltipText ?? folderUri.fsPath;

		const folderIcon = this.isMavenRoot ? new ThemeIcon('folder-library') : new ThemeIcon('symbol-folder');
		this.iconPath = folderIcon;

		const mavenChild = this.isUnderMavenRoot ? 'folder-maven-child' : 'folder';
		this.contextValue = this.isMavenRoot ? 'folder-maven-root' : mavenChild;
		this.description = this.isMavenRoot ? 'M' : undefined;
	}
}
