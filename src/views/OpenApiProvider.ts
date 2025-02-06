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
import { basename, extname, join, normalize } from 'path';
import YAML from 'yaml';

export class OpenApiProvider implements TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void> = new EventEmitter();
    readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private static readonly FILE_PATTERN = '**/*.{yaml,json}';
    private static readonly EXCLUDE_PATTERN = '{**/node_modules/**,**/.vscode/**,**/out/**,**/.camel-jbang*/**,**/*.camel.yaml}';
    private fileWatcher: FileSystemWatcher;

    constructor() {
        this.fileWatcher = workspace.createFileSystemWatcher(OpenApiProvider.FILE_PATTERN);
        this.fileWatcher.onDidChange(uri => this.handleFileChange(uri));
        this.fileWatcher.onDidCreate(uri => this.handleFileChange(uri));
        this.fileWatcher.onDidDelete(uri => this.handleFileChange(uri));
    }

    dispose(): void {
        this.fileWatcher.dispose();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    async getChildren(file?: OpenApiFile): Promise<TreeItem[]> {
        if (file) {
            return []; // No children for individual files
        }
        const files = await this.getOpenApiFilesAvailableInWorkspace();
        if (files.length === 0) {
            return [new TreeItem('No OpenAPI files')];
        }
        return files;
    }

    getTreeItem(file: OpenApiFile): TreeItem {
        return file;
    }

    private async getOpenApiFilesAvailableInWorkspace(): Promise<OpenApiFile[]> {
        const files = await workspace.findFiles(OpenApiProvider.FILE_PATTERN, OpenApiProvider.EXCLUDE_PATTERN);
        const openapiFiles = await Promise.all(files.map(file => this.createOnlyRealOpenApi(normalize(file.fsPath))));
        return openapiFiles.filter((file): file is OpenApiFile => file !== undefined);
    }

    private async createOnlyRealOpenApi(filepath: string): Promise<OpenApiFile | undefined> {
        try {
            const fileToParse = await fsPromises.readFile(filepath, 'utf8');
            const ext = extname(filepath);
            const parsedFile = ext === '.yaml' ? YAML.parse(fileToParse) : JSON.parse(fileToParse);
            if (parsedFile?.openapi) {
                const filename = this.getDisplayName(basename(filepath));
                const openApiVersion = parsedFile.openapi;
                return new OpenApiFile(filename, filepath, openApiVersion);
            }
        } catch (error) {
            console.error(`Error parsing file: ${filepath}`, error);
        }
        return undefined;
    }

    private handleFileChange(uri: Uri): void {
        if (!uri.fsPath.endsWith('.camel.yaml')) {
            this.refresh();
        }
    }

    private getDisplayName(fileName: string): string {
        const match = fileName.match(/^(.+)\.(yaml|json)$/);
        return match ? match[1] : fileName;
    }
}

export class OpenApiFile extends TreeItem {
    constructor(
        public readonly name: string,
        public readonly filepath: string,
        public readonly version: string
    ) {
        super(name, TreeItemCollapsibleState.None);
        this.tooltip = `Open API - version ${this.version}\n${this.filepath}`;
        this.description = basename(filepath);
    }

    iconPath = {
        light: join(__filename, '..', '..', '..', 'icons', 'openapi', 'openapi-light.svg'),
        dark: join(__filename, '..', '..', '..', 'icons', 'openapi', 'openapi-dark.svg'),
    }

    command = { command: 'vscode.open', title: "Open", arguments: [Uri.parse(this.filepath)] };

    contextValue = 'openapi';
}
