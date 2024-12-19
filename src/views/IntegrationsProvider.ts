/**
 * Copyright 2024 Red Hat, Inc. and/or its affiliates.
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
import { promises as fsPromises } from 'fs';
import { Event, EventEmitter, FileSystemWatcher, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, workspace } from 'vscode';
import { basename, join, normalize } from 'path';
import { parse } from 'yaml';

export class IntegrationsProvider implements TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void> = new EventEmitter<TreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private static readonly FILE_PATTERN = '**/*.camel.yaml';
	private static readonly EXCLUDE_PATTERN = '{**/node_modules/**,**/.vscode/**,**/out/**,**/.camel-jbang*/**}';
	private fileWatcher: FileSystemWatcher;

	constructor() {
		this.fileWatcher = workspace.createFileSystemWatcher(IntegrationsProvider.FILE_PATTERN);
		this.fileWatcher.onDidChange(() => this.refresh());
		this.fileWatcher.onDidCreate(() => this.refresh());
		this.fileWatcher.onDidDelete(() => this.refresh());
	}

	dispose(): void {
		this.fileWatcher.dispose();
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(integration: Integration): TreeItem {
		return integration;
	}

	async getChildren(integration?: Integration): Promise<TreeItem[]> {
		if (integration) {
			return await this.getRoutesInsideIntegrationFile(integration.filepath);
		}
		const integrations = await this.getIntegrationsAvailableInWorkspace();
		return integrations;
	}

	private async getIntegrationsAvailableInWorkspace(): Promise<Integration[]> {
		const integrationFiles = await workspace.findFiles(IntegrationsProvider.FILE_PATTERN, IntegrationsProvider.EXCLUDE_PATTERN);

		const integrations: Integration[] = [];

		for (const file of integrationFiles) {
			const filename = basename(file.fsPath);
			const filepath = normalize(file.fsPath);

			// Check if the file has routes
			const routes = await this.getRoutesInsideIntegrationFile(filepath);
			const collapsibleState = routes.length > 0 ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None;

			// Add the IntegrationFile with the correct collapsibleState
			integrations.push(new Integration(
				basename(filename, '.camel.yaml'), // Integration name without extension
				filename,
				filepath,
				collapsibleState
			));
		}

		return integrations;
	}

	private async getRoutesInsideIntegrationFile(filePath: string): Promise<Route[]> {
		try {
			const camelYAMLfile = await fsPromises.readFile(filePath, 'utf8');
			const parsedYaml = parse(camelYAMLfile);
			if (!parsedYaml) {
				return [];
			}

			return (parsedYaml as any[])
				.filter(item => item.route)
				.map(item => new Route(item.route.id, item.route.description));
		} catch (error) {
			console.error(`Error parsing file: ${filePath}`, error);
			return [];
		}
	}
}

export class Integration extends TreeItem {
	constructor(
		public readonly name: string,
		private filename: string,
		public readonly filepath: string,
		public readonly collapsibleState: TreeItemCollapsibleState
	) {
		super(name, collapsibleState);
		this.tooltip = this.filepath;
		this.description = this.filename;
	}

	iconPath = join(__filename, '..', '..', '..', 'icons', 'yaml.svg');

	command = { command: 'kaoto.open', title: 'Open with Kaoto', arguments: [Uri.parse(this.filepath)] };

	contextValue = 'integration';
}

export class Route extends TreeItem {
	constructor(public readonly name: string, public readonly description: string) {
		super(name, TreeItemCollapsibleState.None);
		this.description = description;
	}

	iconPath = {
		light: join(__filename, '..', '..', '..', 'icons', 'route-red.svg'),
		dark: join(__filename, '..', '..', '..', 'icons', 'route-white.svg')
	};

	contextValue = 'route';
}
