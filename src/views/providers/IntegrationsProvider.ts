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
import { commands, Event, EventEmitter, FileSystemWatcher, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, workspace } from 'vscode';
import { basename, join, relative, sep } from 'path';
import { parse } from 'yaml';
import { XMLParser } from 'fast-xml-parser';
import { KaotoOutputChannel } from '../../extension/KaotoOutputChannel';
import { Integration } from '../integrationTreeItems/Integration';
import { Route } from '../integrationTreeItems/Route';
import { Folder } from '../integrationTreeItems/Folder';
import { File } from '../integrationTreeItems/File';
import { KAOTO_INTEGRATIONS_FILES_REGEXP_SETTING_ID } from '../../helpers/helpers';

type TreeItemType = TreeItem | undefined | null | void;

export class IntegrationsProvider implements TreeDataProvider<TreeItem> {
	private readonly _onDidChangeTreeData: EventEmitter<TreeItemType> = new EventEmitter<TreeItemType>();
	readonly onDidChangeTreeData: Event<TreeItemType> = this._onDidChangeTreeData.event;

	private static readonly FILE_PATTERN =
		'{**/*.camel.yaml,**/*.camel.xml,**/*.kamelet.yaml,**/*-pipe.yaml,**/*.pipe.yaml,**/*application*.properties,**/*.xsl,**/pom.xml}';
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

	getTreeItem(element: TreeItem): TreeItem {
		return element;
	}

	async getChildren(element?: TreeItem): Promise<TreeItem[]> {
		if (element instanceof Integration) {
			const routes = element.type === 'route' ? await this.getRoutesInsideIntegrationFile(element.dsl, element.filepath) : [];
			return routes || [];
		}

		const files = await workspace.findFiles(IntegrationsProvider.FILE_PATTERN, IntegrationsProvider.EXCLUDE_PATTERN);
		this.setContext(files.length > 0);

		if (!element) {
			const wfs = workspace.workspaceFolders || [];
			if (wfs.length === 1) {
				return await this.buildChildrenForPath(files, wfs[0].uri.fsPath, false, true);
			}
			const folders = wfs
				.filter((wf) => files.some((f) => f.fsPath.startsWith(wf.uri.fsPath + sep)))
				.map(
					(wf) =>
						new Folder(
							wf.name,
							wf.uri,
							undefined,
							false,
							files.some((f) => f.fsPath === join(wf.uri.fsPath, 'pom.xml')),
						),
				);
			return folders;
		}

		if (element instanceof Folder) {
			return await this.buildChildrenForPath(files, element.folderUri.fsPath, element.isUnderMavenRoot, false);
		}

		return [];
	}

	private async buildChildrenForPath(
		files: readonly Uri[],
		parentPath: string,
		ancestorUnderMavenRoot: boolean,
		parentIsWorkspaceRoot: boolean,
	): Promise<TreeItem[]> {
		const directFiles: Uri[] = [];
		const subfolderNames = new Set<string>();

		for (const file of files) {
			if (!file.fsPath.startsWith(parentPath + sep)) {
				continue;
			}
			const rel = relative(parentPath, file.fsPath);
			const parts = rel.split(sep);
			if (parts.length === 1) {
				directFiles.push(file);
			} else if (parts.length > 1) {
				subfolderNames.add(parts[0]);
			}
		}

		const hasPomXml = directFiles.some((f) => basename(f.fsPath) === 'pom.xml');
		const underMavenRootForChildren = ancestorUnderMavenRoot || hasPomXml;

		const subfolders = Array.from(subfolderNames.values())
			.sort((a, b) => a.localeCompare(b))
			.map((name) => {
				const childPath = join(parentPath, name);
				const isChildMavenRoot = files.some((f) => f.fsPath === join(childPath, 'pom.xml'));
				return new Folder(name, Uri.file(childPath), undefined, underMavenRootForChildren, isChildMavenRoot);
			});

		const fileItems = await Promise.all(
			directFiles
				.sort((a, b) => a.fsPath.localeCompare(b.fsPath))
				.map(async (file) => this.toTreeItemForFile(file, underMavenRootForChildren, parentIsWorkspaceRoot && !underMavenRootForChildren)),
		);

		const items: TreeItem[] = [...subfolders, ...fileItems];
		items.sort((a, b) => {
			const aHasChildren = a.collapsibleState !== TreeItemCollapsibleState.None ? 1 : 0;
			const bHasChildren = b.collapsibleState !== TreeItemCollapsibleState.None ? 1 : 0;
			if (aHasChildren !== bHasChildren) {
				return bHasChildren - aHasChildren;
			}
			const aLabel = this.getItemLabel(a);
			const bLabel = this.getItemLabel(b);
			return aLabel.localeCompare(bLabel);
		});

		return items;
	}

	private getItemLabel(item: TreeItem): string {
		if (typeof item.label === 'string') {
			return item.label;
		}
		if (item.label && typeof (item.label as any).label === 'string') {
			return (item.label as any).label;
		}
		return '';
	}

	private setContext(value: boolean): void {
		commands.executeCommand('setContext', 'kaoto.integrationExists', value);
	}

	private getFileType(fileName: string): { dsl: string; type: string; name: string } {
		if (fileName.endsWith('.kamelet.yaml')) {
			return { dsl: 'yaml', type: 'kamelet', name: basename(fileName, '.kamelet.yaml') };
		}
		if (fileName.endsWith('-pipe.yaml')) {
			return { dsl: 'yaml', type: 'pipe', name: basename(fileName, '-pipe.yaml') };
		}
		if (fileName.endsWith('.pipe.yaml')) {
			return { dsl: 'yaml', type: 'pipe', name: basename(fileName, '.pipe.yaml') };
		}
		if (fileName.endsWith('.camel.xml')) {
			return { dsl: 'xml', type: 'route', name: basename(fileName, '.camel.xml') };
		}
		return { dsl: 'yaml', type: 'route', name: basename(fileName, '.camel.yaml') };
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

	private async toTreeItemForFile(file: Uri, isUnderMavenRoot: boolean = false, isTopLevelWithinWorkspace: boolean = true): Promise<TreeItem> {
		const filename = basename(file.fsPath);
		// Treat Camel, Kamelet and Pipe files as Integration items; others as plain files
		if (
			filename.endsWith('.camel.yaml') ||
			filename.endsWith('.camel.xml') ||
			filename.endsWith('.kamelet.yaml') ||
			filename.endsWith('.pipe.yaml') ||
			filename.endsWith('-pipe.yaml')
		) {
			const { dsl, type, name } = this.getFileType(filename);
			const icon = this.getIcon(type);
			const description = this.getDescription(type);
			let collapsibleState = TreeItemCollapsibleState.None;
			if (type === 'route') {
				const routes = await this.getRoutesInsideIntegrationFile(dsl, file);
				collapsibleState = routes.length > 0 ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None;
			}
			return new Integration(name, filename, file, collapsibleState, type, dsl, icon, description, isUnderMavenRoot, isTopLevelWithinWorkspace);
		}
		return new File(file, filename);
	}
	getDescription(type: string) {
		switch (type) {
			case 'kamelet':
				return 'Kamelet';
			case 'pipe':
				return 'Pipe';
			case 'route':
				return 'Camel Route';
			default:
				return 'Unknown';
		}
	}

	private async getRoutesInsideIntegrationFile(dsl: string, filePath: Uri): Promise<Route[]> {
		switch (dsl) {
			case 'yaml':
				return await this.parseYamlFile(filePath);
			case 'xml':
				return await this.parseXmlFile(filePath);
			default:
				return [];
		}
	}

	private async parseYamlFile(filePath: Uri): Promise<Route[]> {
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
			KaotoOutputChannel.logError(`Error parsing YAML file: ${filePath.fsPath}`, error);
			return [];
		}
	}

	private async parseXmlFile(filePath: Uri): Promise<Route[]> {
		try {
			const fileBuffer = await workspace.fs.readFile(filePath);
			if (!fileBuffer || fileBuffer.length === 0) {
				// skip empty XML file
				return [];
			}

			const fileContent = fileBuffer.toString().trim(); // remove unnecessary whitespaces

			const parser = new XMLParser({
				ignoreAttributes: false,
				attributeNamePrefix: '',
				parseAttributeValue: true,
				trimValues: true,
				isArray: (name) => name === 'route', // force route to always be an array
			});

			const parsedXml = parser.parse(fileContent);
			if (!parsedXml || typeof parsedXml !== 'object') {
				KaotoOutputChannel.logWarning(`Invalid XML structure: ${filePath.fsPath}`);
				return [];
			}

			// normalize route structure (handling JBang init vs Kaoto XML)
			let routes: any[] = [];
			if (parsedXml.routes?.route) {
				routes = Array.isArray(parsedXml.routes.route) ? parsedXml.routes.route : [parsedXml.routes.route];
			} else if (parsedXml.camel?.route) {
				routes = Array.isArray(parsedXml.camel.route) ? parsedXml.camel.route : [parsedXml.camel.route];
			} else {
				KaotoOutputChannel.logWarning(`No <route> elements found in XML: ${filePath.fsPath}`);
				return [];
			}

			return routes.map((route) => new Route(route.id, route.description, this.getIcon('route-child')));
		} catch (error) {
			KaotoOutputChannel.logError(`Error parsing XML file: ${filePath.fsPath}`, error);
			return [];
		}
	}
}
