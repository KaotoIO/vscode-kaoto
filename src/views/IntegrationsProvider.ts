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
import { globSync } from 'glob';
import { readFileSync } from 'node:fs';
import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { basename, join } from 'path';
import { parse } from 'yaml';

export class IntegrationsProvider implements TreeDataProvider<TreeItem> {

	private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void> = new EventEmitter<TreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private readonly CAMEL_FILE_PATTERN: string = '.camel.yaml';

	constructor(private workspaceRoot: string) { }

	getTreeItem(integration: IntegrationFile): TreeItem {
		return integration;
	}

	getChildren(integration?: IntegrationFile): Thenable<TreeItem[]> {
		if (!this.workspaceRoot) {
			return Promise.resolve([]);
		}

		if(integration) {
			return Promise.resolve(this.getRoutesInsideIntegrationFile(integration));
		} else {
			return Promise.resolve(this.getIntegrationsAvailableInWorkspace(this.workspaceRoot));
		}
	}

	private getIntegrationsAvailableInWorkspace(workspaceRoot: string): IntegrationFile[] {
		const integrationFiles = globSync(`${workspaceRoot}/**/*${this.CAMEL_FILE_PATTERN}`);
		let integrations: IntegrationFile[] = [];
		for (const filepath of integrationFiles) {
			const filename = basename(filepath);
			integrations.push(new IntegrationFile(this.getIntegrationName(filename), filename, filepath, TreeItemCollapsibleState.Expanded));
		}
		return integrations;
	}

	private getIntegrationName(filename: string): string {
		return filename.split(new RegExp(String.raw`${this.CAMEL_FILE_PATTERN}`, 'gm'))[0];
	}

	private getRoutesInsideIntegrationFile(integration: IntegrationFile): Route[] {
		const camelYAMLfile = readFileSync(integration.filepath, 'utf8');
		const parsedYaml = parse(camelYAMLfile);
		if(!parsedYaml) {
			return [];
		}

		let routesArray: Route[] = [];
		for (const topLevelElement of parsedYaml) {
			const route = topLevelElement.route;
			if(route) {
				routesArray.push(new Route(route.id, route.description));
			}
		}
		return routesArray;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}
}

export class IntegrationFile extends TreeItem {
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

	iconPath = join(__filename, '..', '..', '..', 'icons', 'yaml.svg')

	command = { command: 'kaoto.open', title: "Open with Kaoto", arguments: [Uri.parse(this.filepath)] };

	contextValue = 'integrationFile';
}

export class Route extends TreeItem {
	constructor(
		public readonly name: string,
		public readonly description: string
	) {
		super(name, TreeItemCollapsibleState.None);
		this.description = this.description;
	}

	iconPath = {
		light: join(__filename, '..', '..', '..', 'icons', 'route-red.svg'),
		dark: join(__filename, '..', '..', '..', 'icons', 'route-white.svg'),
	}

	contextValue = 'route';
}
