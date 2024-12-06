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
import { basename, extname, join } from 'path';
import YAML from 'yaml';

export class OpenApiProvider implements TreeDataProvider<TreeItem> {

    private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void> = new EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private readonly YAML_FILE_PATTERN: string = '.yaml';
    private readonly JSON_FILE_PATTERN: string = '.json';

    constructor(private workspaceRoot: string) { }

    getTreeItem(file: OpenApiFile): TreeItem {
        return file;
    }

    getChildren(file?: OpenApiFile): Thenable<TreeItem[]> {
        if (!this.workspaceRoot) {
            return Promise.resolve([]);
        }
        return Promise.resolve(this.getOpenApiFilesAvailableInWorkspace(this.workspaceRoot));
    }

    private getOpenApiFilesAvailableInWorkspace(workspaceRoot: string): OpenApiFile[] {
        const files = globSync([`${workspaceRoot}/**/*${this.YAML_FILE_PATTERN}`, `${workspaceRoot}/**/*${this.JSON_FILE_PATTERN}`], { ignore: `${workspaceRoot}/**/*.camel.yaml` });
        let openapiFiles: OpenApiFile[] = [];
        for (const filepath of files) {
            const openApiFile = this.createOnlyRealOpenApi(filepath);
            openApiFile !== undefined ? openapiFiles.push(openApiFile) : 0;
        }
        return openapiFiles;
    }

    private createOnlyRealOpenApi(filepath: string): OpenApiFile | undefined {
        const filename = basename(filepath);
        const ext = extname(filepath);

        const fileToParse = readFileSync(filepath, 'utf8');
        let parsedFile: any = {};
        if (ext === this.YAML_FILE_PATTERN) {
            parsedFile = YAML.parse(fileToParse);
        } else if (ext === this.JSON_FILE_PATTERN) {
            parsedFile = JSON.parse(fileToParse);
        }
        if (parsedFile && parsedFile.openapi) {
            return new OpenApiFile(this.getOpenApiFilename(filename), filename, filepath);
        }
        return undefined;
    }

    private getOpenApiFilename(filename: string): string {
        return filename.split(new RegExp(String.raw`${this.YAML_FILE_PATTERN}|${this.JSON_FILE_PATTERN}`, 'gm'))[0];
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}

export class OpenApiFile extends TreeItem {
    constructor(
        public readonly name: string,
        private filename: string,
        public readonly filepath: string
    ) {
        super(name, TreeItemCollapsibleState.None);
        this.tooltip = this.filepath;
        this.description = this.filename;
    }

    iconPath = {
		light: join(__filename, '..', '..', '..', 'icons', 'openapi', 'openapi-light.svg'),
		dark: join(__filename, '..', '..', '..', 'icons', 'openapi', 'openapi-dark.svg'),
	}

    command = { command: 'vscode.open', title: "Open", arguments: [Uri.parse(this.filepath)] };

    contextValue = 'openapi';
}
