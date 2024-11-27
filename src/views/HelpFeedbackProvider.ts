import { join } from 'path';
import { ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';

export class HelpFeedbackProvider implements TreeDataProvider<HelpFeedbackItem> {

	getTreeItem(item: HelpFeedbackItem): HelpFeedbackItem {
		return item;
	}

	getChildren(item?: HelpFeedbackItem): Thenable<HelpFeedbackItem[]> {
        return Promise.resolve(this.getHelpFeedbackItems());
	}

    private getHelpFeedbackItems(): HelpFeedbackItem[] {
        return [
            new HelpFeedbackItem('Enterprise Integration Explorer',  join(__filename, '..', '..', '..', 'icons', 'help', 'integration.svg'), 'https://camel.solutionpatterns.io/#/patterns'),
            new HelpFeedbackItem('Tutorials',  new ThemeIcon('library'), 'https://kaoto.io/workshop/'),
            new HelpFeedbackItem('Documentation', new ThemeIcon('book'), 'https://kaoto.io/docs/'),
            new HelpFeedbackItem('Examples', new ThemeIcon('github'), 'https://github.com/KaotoIO/kaoto-examples'),
            new HelpFeedbackItem('Feedback', new ThemeIcon('comment'), 'https://github.com/KaotoIO/kaoto/issues/new/choose'),
            new HelpFeedbackItem('Apache Camel', join(__filename, '..', '..', '..', 'icons', 'help', 'camel-logo.svg'), 'https://camel.apache.org/camel-core/getting-started/index.html'),
            new HelpFeedbackItem('Hawtio', new ThemeIcon('flame'), 'https://hawt.io/docs/get-started.html')
        ];
    }
}

export class HelpFeedbackItem extends TreeItem {
	constructor(
		public readonly name: string,
		public readonly icon: string | Uri | { light: string | Uri; dark: string | Uri } | ThemeIcon,
        public readonly url: string
	) {
		super(name, TreeItemCollapsibleState.None);
	}

    command = { command: 'vscode.open', title: `Open ${this.name}`, arguments: [Uri.parse(this.url)] };

	iconPath = this.icon;

    contextValue = 'help';
}
