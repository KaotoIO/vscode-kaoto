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
import { commands, Event, EventEmitter, FileSystemWatcher, IconPath, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, workspace } from 'vscode';
import { basename, dirname, join, relative } from 'path';
import { parse } from 'yaml';
import { KaotoOutputChannel } from '../../extension/KaotoOutputChannel';

type TreeItemType = TreeItem | undefined | null | void;

export class IntegrationsProvider implements TreeDataProvider<TreeItem> {
	private readonly _onDidChangeTreeData: EventEmitter<TreeItemType> = new EventEmitter<TreeItemType>();
	readonly onDidChangeTreeData: Event<TreeItemType> = this._onDidChangeTreeData.event;

	private static readonly FILE_PATTERN = '{**/*.camel.yaml,**/*.kamelet.yaml,**/*-pipe.yaml,**/*.pipe.yaml}';
	private static readonly EXCLUDE_PATTERN = '{**/node_modules/**,**/.vscode/**,**/out/**,**/.camel-jbang*/**,**/target/**}';
	private readonly fileWatcher: FileSystemWatcher;

	constructor(readonly extensionUriPath: string) {
		this.fileWatcher = workspace.createFileSystemWatcher(IntegrationsProvider.FILE_PATTERN);
		this.fileWatcher.onDidChange(this.refresh.bind(this));
		this.fileWatcher.onDidCreate(this.refresh.bind(this));
		this.fileWatcher.onDidDelete(this.refresh.bind(this));
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
		this.setContext(integrations.length > 0);
		return integrations;
	}

	private setContext(value: boolean): void {
		commands.executeCommand('setContext', 'kaoto.integrationExists', value);
	}

	private getFileType(fileName: string): { type: string; name: string } {
		if (fileName.endsWith('.kamelet.yaml')) {
			return { type: 'kamelet', name: basename(fileName, '.kamelet.yaml') };
		}
		if (fileName.endsWith('-pipe.yaml')) {
			return { type: 'pipe', name: basename(fileName, '-pipe.yaml') };
		}
		if (fileName.endsWith('.pipe.yaml')) {
			return { type: 'pipe', name: basename(fileName, '.pipe.yaml') };
		}
		return { type: 'route', name: basename(fileName, '.camel.yaml') };
	}

	private getIcon(type: string): { light: Uri; dark: Uri } {
		const basePath = join(this.extensionUriPath, 'icons', 'integrations');
		switch (type) {
			case 'kamelet':
				return { light: Uri.file(join(basePath, 'kamelets-file-icon-light.png')), dark: Uri.file(join(basePath, 'kamelets-file-icon-dark.png')) };
			case 'pipe':
				return { light: Uri.file(join(basePath, 'pipes-file-icon-light.png')), dark: Uri.file(join(basePath, 'pipes-file-icon-dark.png')) };
			case 'route':
				return { light: Uri.file(join(basePath, 'routes-file-icon-light.png')), dark: Uri.file(join(basePath, 'routes-file-icon-dark.png')) };
			case 'route-child':
				return { light: Uri.file(join(basePath, 'route-black.svg')), dark: Uri.file(join(basePath, 'route-white.svg')) };
			// every unknown is considered as Route integration file
			default:
				return { light: Uri.file(join(basePath, 'routes-file-icon-light.png')), dark: Uri.file(join(basePath, 'routes-file-icon-light.png')) };
		}
	}

	private async getIntegrationsAvailableInWorkspace(): Promise<Integration[]> {
		const integrationFiles = await workspace.findFiles(IntegrationsProvider.FILE_PATTERN, IntegrationsProvider.EXCLUDE_PATTERN);
		const integrations = await Promise.all(
			integrationFiles.map(async (file) => {
				const filename = basename(file.fsPath);
				const { type, name } = this.getFileType(filename);
				const icon = this.getIcon(type);

				// process routes only if it's a route integration
				const routes = type === 'route' ? await this.getRoutesInsideIntegrationFile(file) : [];
				const collapsibleState = routes.length > 0 ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None;

				return new Integration(name, filename, file, collapsibleState, type, icon);
			}),
		);
		return Array.from(integrations.values()).sort((a, b) => a.filepath.fsPath.localeCompare(b.filepath.fsPath));
	}

	private async getRoutesInsideIntegrationFile(filePath: Uri): Promise<Route[]> {
		try {
			const fileBuffer = await workspace.fs.readFile(filePath);
			const parsedYaml = parse(String.fromCharCode.apply(null, fileBuffer));

			// skip empty YAML files
			if (!parsedYaml || typeof parsedYaml !== 'object') {
				return [];
			}

			return Object.values(parsedYaml)
				.filter((item: any) => item.route)
				.map((item: any) => new Route(item.route.id, item.route.description, this.getIcon('route-child')));
		} catch (error) {
			KaotoOutputChannel.logError(`Error parsing file: ${filePath.fsPath}`, error);
			return [];
		}
	}
}

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
