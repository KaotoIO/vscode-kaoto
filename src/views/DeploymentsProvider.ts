import { execSync } from 'child_process';
import { join } from 'path';
import { Event, EventEmitter, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';

export class DeploymentsProvider implements TreeDataProvider<TreeItem> {

    private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void> = new EventEmitter<TreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	getTreeItem(item: TreeItem): TreeItem {
		return item;
	}

	getChildren(item?: TreeItem): Thenable<TreeItem[]> {
        if(item) {
            if(item.name === 'Localhost') {
                return Promise.resolve(this.getLocalhostDeployments());
            } else {
                // kubernetes
                // TODO
                return Promise.resolve([]);
            }
        } else {
            return Promise.resolve([
                new ParentDeploymentItem('Localhost', 'desktop-download', TreeItemCollapsibleState.Expanded),
                new ParentDeploymentItem('Kubernetes', 'cloud-upload', TreeItemCollapsibleState.Collapsed)
            ]);
        }
	}

    private getLocalhostDeployments(): LocalhostDeploymentItem[] {
        // TODO migrate to JBang exec API external class
        const execOutput = execSync('jbang camel@apache/camel ps', { stdio: 'pipe' }).toString();
        const names = this.parseShellResult(execOutput);
        return names.slice(1).map((name) => new LocalhostDeploymentItem(name));
    }

    private parseShellResult(output: string) : string[] {
        const processedList: string[] = [];
        if (output) {
            const lines: string[] = output.split('\n');
            for (const entry of lines) {
                const spaceSplittedLine: string[] = entry.split('  ');
                const cleanLine = [];
                for (const value of spaceSplittedLine) {
                    if (value.trim().length === 0) {
                        continue;
                    }
                    cleanLine.push(value.trim());
                }
                const firstString: string = cleanLine[1];
                if (firstString === undefined || firstString.toUpperCase().startsWith('PID') || firstString.trim().length === 0) {
                    continue;
                }
                const itemName = cleanLine[1];
                processedList.push(itemName);
            }
        }
        return processedList;
    }

    refresh(): void {
		this._onDidChangeTreeData.fire();
	}
}

export class ParentDeploymentItem extends TreeItem {
	constructor(
		public readonly label: string,
        public readonly icon: string,
        public readonly expanded: TreeItemCollapsibleState
	) {
		super(label, expanded);
	}

    name = this.label;

    iconPath = new ThemeIcon(this.icon);

    contextValue = 'deployment';
}

export class LocalhostDeploymentItem extends TreeItem {
    // TODO show PID as item description and TOTAL, FAIL, ... as tooltip
    // Total (0/227) - Fail (0/0) - Inflight (0/0)
	constructor(
		public readonly name: string,
	) {
		super(name, TreeItemCollapsibleState.None);
	}

    tooltip = 'Status: Running';

    iconPath = join(__filename, '..', '..', '..', 'icons', 'running-camel.png');

    contextValue = 'localhost';
}
