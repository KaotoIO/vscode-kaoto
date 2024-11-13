import * as vscode from 'vscode';
import * as path from 'path';
import { globSync } from 'glob';

export class IntegrationsProvider implements vscode.TreeDataProvider<Integration> {

	private _onDidChangeTreeData: vscode.EventEmitter<Integration | undefined | null | void> = new vscode.EventEmitter<Integration | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<Integration | undefined | null | void> = this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string) { }

	getTreeItem(integrationEntry: Integration): vscode.TreeItem {
		return integrationEntry;
	}

	getChildren(integrationEntry?: Integration): Thenable<Integration[]> {
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('No integrations in empty workspace');
			return Promise.resolve([]);
		}
		return Promise.resolve(this.getIntegrationsAvailableInWorkspace(this.workspaceRoot));
	}

	private getIntegrationsAvailableInWorkspace(workspaceRoot: string): Integration[] {
		const integrationFiles = globSync(`${workspaceRoot}/**/*.camel.yaml`);
		let integrations: Integration[] = [];
		for (const filepath of integrationFiles) {
			const filename = path.basename(filepath);
			integrations.push(new Integration(this.getIntegrationName(filename), filename, filepath, vscode.TreeItemCollapsibleState.None));
		}
		return integrations;
	}

	private getIntegrationName(filename: string): string {
		return filename.split(/.camel.yaml/gm)[0];
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}
}

export class Integration extends vscode.TreeItem {
	constructor(
		public readonly name: string,
		private filename: string,
		public readonly filepath: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(name, collapsibleState);
		this.tooltip = this.filename;
		this.description = this.filename;
	}

	iconPath = vscode.ThemeIcon.File;

	command = { command: 'kaoto.open', title: "Open with Kaoto", arguments: [vscode.Uri.parse(this.filepath)] };

	contextValue = 'integration';
}
