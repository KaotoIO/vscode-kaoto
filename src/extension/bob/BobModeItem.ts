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

export class BobModeItem extends TreeItem {
	static readonly CONTEXT_VALUE = 'bobMode';

	constructor(
		public readonly slug: string,
		name: string | undefined,
		public readonly fileUri: Uri,
		public readonly line: number,
		modeDescription: string | undefined = undefined,
	) {
		super(name ?? slug, TreeItemCollapsibleState.None);
		this.description = slug;
		this.tooltip = modeDescription ?? name ?? slug;
		this.iconPath = new ThemeIcon('symbol-misc');
		this.contextValue = BobModeItem.CONTEXT_VALUE;
		this.command = {
			command: 'vscode.openWith',
			title: 'Open in Kaoto',
			arguments: [fileUri, 'webviewEditorsKaoto'],
		};
	}
}
