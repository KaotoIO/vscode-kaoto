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
import { commands, Event, EventEmitter, FileSystemWatcher, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, workspace } from 'vscode';
import { basename, join, normalize } from 'path';
import { parse } from 'yaml';

export class IntegrationsProvider implements TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void> = new EventEmitter<TreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private static readonly FILE_PATTERN = '{**/*.camel.yaml,**/*.kamelet.yaml,**/*-pipe.yaml}';
	private static readonly EXCLUDE_PATTERN = '{**/node_modules/**,**/.vscode/**,**/out/**,**/.camel-jbang*/**,**/target/**}';
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
			return integration.type === 'route' ? await this.getRoutesInsideIntegrationFile(integration.filepath) : [];
		}
		const integrations = await this.getIntegrationsAvailableInWorkspace();
		integrations.length > 0 ? this.setContext(true) : this.setContext(false);
		return integrations;
	}

	private setContext(value: boolean) {
		commands.executeCommand('setContext', 'kaoto.integrationExists', value);
	}

	private getInfo(fileName: string): { type: string, name: string } {
		if (fileName.endsWith('.kamelet.yaml')) {
			return {
				type: 'kamelet',
				name: basename(fileName, '.kamelet.yaml') // Integration name without extension
			};
		} else if (fileName.endsWith('-pipe.yaml')) {
			return {
				type: 'pipe',
				name: basename(fileName, '-pipe.yaml') // Integration name without extension
			};
		} else {
			return {
				type: 'route',
				name: basename(fileName, '.camel.yaml') // Integration name without extension
			};
		}
	}

	private async getIntegrationsAvailableInWorkspace(): Promise<Integration[]> {
		const integrationFiles = await workspace.findFiles(IntegrationsProvider.FILE_PATTERN, IntegrationsProvider.EXCLUDE_PATTERN);

		const integrations: Integration[] = [];

		for (const file of integrationFiles) {
			const filename = basename(file.fsPath);
			const filepath = normalize(file.fsPath);
			const int = this.getInfo(filename);

			// Check if the file has routes
			let routes = [];
			if(int.type === 'route') {
				routes = await this.getRoutesInsideIntegrationFile(filepath);
			}
			const collapsibleState = routes.length > 0 ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None; // TODO here needs to be handled better to really expand automatically when eg new routes are created in empty file

			// Add the IntegrationFile with the correct collapsibleState
			integrations.push(new Integration(
				int.name, // Integration name without extension
				filename,
				filepath,
				collapsibleState,
				int.type
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
		public collapsibleState: TreeItemCollapsibleState,
		public readonly type: string
	) {
		super(name, collapsibleState);
		this.tooltip = this.filepath;
		this.description = this.filename;
	}

	iconPath = {
		light: this.getIcon(this.type).light,
		dark: this.getIcon(this.type).dark
	};

	command = { command: 'kaoto.open', title: 'Open with Kaoto', arguments: [Uri.parse(this.filepath)] };

	contextValue = 'integration';

	public setCollapsibleState(state: TreeItemCollapsibleState) {
		this.collapsibleState = state;
	}

	private getIcon(type: string): { dark: string, light: string } {
		switch (type) {
			case 'kamelet':
				return {
					light: join(__filename, '..', '..', '..', 'icons', 'integrations', 'kamelets-file-icon-light.png'),
					dark: join(__filename, '..', '..', '..', 'icons', 'integrations', 'kamelets-file-icon-dark.png')
				}
			case 'pipe':
				return {
					light: join(__filename, '..', '..', '..', 'icons', 'integrations', 'pipes-file-icon-light.png'),
					dark: join(__filename, '..', '..', '..', 'icons', 'integrations', 'pipes-file-icon-dark.png')
				}
			default:
				// every other considered as Camel Route file
				return {
					light: join(__filename, '..', '..', '..', 'icons', 'integrations', 'routes-file-icon-light.png'),
					dark: join(__filename, '..', '..', '..', 'icons', 'integrations', 'routes-file-icon-dark.png')
				}
		}
	}
}

export class Route extends TreeItem {
	constructor(public readonly name: string, public readonly description: string) {
		super(name, TreeItemCollapsibleState.None);
		this.description = description;
	}

	iconPath = {
		light: join(__filename, '..', '..', '..', 'icons', 'integrations', 'route-black.svg'),
		dark: join(__filename, '..', '..', '..', 'icons', 'integrations', 'route-white.svg')
	};

	contextValue = 'route';
}
