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
import * as vscode from 'vscode';
import * as path from 'path';

export class TestsProvider implements vscode.TreeDataProvider<TestItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TestItem | undefined | void> = new vscode.EventEmitter<TestItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TestItem | undefined | void> = this._onDidChangeTreeData.event;

    private static readonly FILE_PATTERN = '**/*.{it.yaml,test.yaml}';
    private static readonly EXCLUDE_PATTERN = '{**/node_modules/**,**/.vscode/**,**/out/**,**/.camel-jbang*/**}';

    private fileWatcher: vscode.FileSystemWatcher;

    constructor() {
        // Setup file system watcher for .xsl files in the workspace
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(TestsProvider.FILE_PATTERN);

        // Listen to file changes and trigger refresh
        this.fileWatcher.onDidCreate(() => this.refresh());
        this.fileWatcher.onDidChange(() => this.refresh());
        this.fileWatcher.onDidDelete(() => this.refresh());
    }

    dispose(): void {
        this.fileWatcher.dispose();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TestItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TestItem): Promise<TestItem[]> {
        if (element) {
            return []; // No children for individual files
        }
        const files = await vscode.workspace.findFiles(TestsProvider.FILE_PATTERN, TestsProvider.EXCLUDE_PATTERN);
        return files.map(file => new TestItem(this.getDisplayName(path.basename(file.fsPath)), path.normalize(file.fsPath)));
    }

    private getDisplayName(fileName: string): string {
        const match = fileName.match(/^(.+)\.(it|test)\.yaml$/);
        return match ? match[1] : fileName;
    }
}

export class TestItem extends vscode.TreeItem {
    constructor(public readonly fileName: string, public readonly filePath: string) {
        super(fileName, vscode.TreeItemCollapsibleState.None);

        this.description = path.basename(filePath);

        this.iconPath = path.join(__filename, '..', '..', '..', 'icons', 'tests', 'test.svg');

        // Command to open the file in the editor when clicked
        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [vscode.Uri.file(this.filePath)],
        };

        this.tooltip = this.filePath;

        this.contextValue = 'test';
    }
}
