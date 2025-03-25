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
import { TreeItem, IconPath, TreeItemCollapsibleState } from 'vscode';

export class Route extends TreeItem {
	constructor(
		public readonly name: string,
		public readonly description: string,
		public readonly icon: string | IconPath,
	) {
		super(name || '[missing route id]', TreeItemCollapsibleState.None);
		this.description = description;
		this.iconPath = icon;
	}

	contextValue = 'route';
}
