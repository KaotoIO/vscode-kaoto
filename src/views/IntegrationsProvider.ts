import { Event, EventEmitter, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, window } from 'vscode';
import { basename } from 'path';
import { globSync } from 'glob';

export class IntegrationsProvider implements TreeDataProvider<Integration> {

	private _onDidChangeTreeData: EventEmitter<Integration | undefined | null | void> = new EventEmitter<Integration | undefined | null | void>();
	readonly onDidChangeTreeData: Event<Integration | undefined | null | void> = this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string) { }

	getTreeItem(integrationEntry: Integration): TreeItem {
		return integrationEntry;
	}

	getChildren(integrationEntry?: Integration): Thenable<Integration[]> {
		if (!this.workspaceRoot) {
			window.showInformationMessage('No integrations in empty workspace');
			return Promise.resolve([]);
		}
		return Promise.resolve(this.getIntegrationsAvailableInWorkspace(this.workspaceRoot));
	}

	private getIntegrationsAvailableInWorkspace(workspaceRoot: string): Integration[] {
		const integrationFiles = globSync(`${workspaceRoot}/**/*.camel.yaml`);
		let integrations: Integration[] = [];
		for (const filepath of integrationFiles) {
			const filename = basename(filepath);
			integrations.push(new Integration(this.getIntegrationName(filename), filename, filepath, TreeItemCollapsibleState.None));
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

export class Integration extends TreeItem {
	constructor(
		public readonly name: string,
		private filename: string,
		public readonly filepath: string,
		public readonly collapsibleState: TreeItemCollapsibleState
	) {
		super(name, collapsibleState);
		this.tooltip = this.filename;
		this.description = this.filename;
	}

	iconPath = ThemeIcon.File;

	command = { command: 'kaoto.open', title: "Open with Kaoto", arguments: [Uri.parse(this.filepath)] };

	contextValue = 'integration';
}
