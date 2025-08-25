import * as vscode from 'vscode';
import * as path from 'path';
import { KaotoOutputChannel } from '../extension/KaotoOutputChannel';
import { CamelDependencyUpdateJBangTask } from '../tasks/CamelDependencyUpdateJBangTask';
import { findFolderOfPomXml } from './helpers';

export class StepsOnSaveManager {
	private static _instance: StepsOnSaveManager | undefined;
	public static get instance(): StepsOnSaveManager {
		this._instance ??= new StepsOnSaveManager();
		return this._instance;
	}

	private readonly hasStepsByDocPath: Map<string, boolean> = new Map();
	private readonly watcherByDocPath: Map<string, vscode.FileSystemWatcher> = new Map();
	private readonly debounceByDocPath: Map<string, NodeJS.Timeout> = new Map();

	public markStepsAdded(docUri: vscode.Uri): void {
		const docPath = docUri.fsPath;
		if (this.hasStepsByDocPath.get(docPath) === true) {
			return; // steps already added
		}
		this.hasStepsByDocPath.set(docPath, true); // flag to indicate that steps have been added to the Kaoto UI
		this.ensureWatcher(docUri);
	}

	public disposeFor(docUri: vscode.Uri): void {
		const docPath = docUri.fsPath;
		this.hasStepsByDocPath.delete(docPath);
		const watcher = this.watcherByDocPath.get(docPath);
		if (watcher) {
			watcher.dispose();
			this.watcherByDocPath.delete(docPath);
		}
	}

	private ensureWatcher(docUri: vscode.Uri): void {
		const docPath = docUri.fsPath;
		if (this.watcherByDocPath.has(docPath)) {
			return; // watcher already exists
		}

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(docUri);
		const pattern = workspaceFolder
			? new vscode.RelativePattern(workspaceFolder, path.relative(workspaceFolder.uri.fsPath, docUri.fsPath))
			: new vscode.RelativePattern(path.dirname(docUri.fsPath), path.basename(docUri.fsPath));

		const fsWatcher = vscode.workspace.createFileSystemWatcher(pattern);
		const onFsChange = () => {
			const existingTimeout = this.debounceByDocPath.get(docPath);
			if (existingTimeout) {
				clearTimeout(existingTimeout);
			}
			const timeout = setTimeout(() => {
				this.debounceByDocPath.delete(docPath);
				void this.onSaved(docPath); // debounce to avoid multiple calls to onSaved
			}, 300);
			this.debounceByDocPath.set(docPath, timeout);
		};
		fsWatcher.onDidChange(onFsChange);
		fsWatcher.onDidCreate(onFsChange);
		this.watcherByDocPath.set(docPath, fsWatcher); // store watcher for the document
	}

	private async onSaved(docPath: string): Promise<void> {
		const hadSteps = this.hasStepsByDocPath.get(docPath) === true;
		if (!hadSteps) {
			return;
		}

		// reset flag first
		this.hasStepsByDocPath.set(docPath, false);

		const pomFolder = findFolderOfPomXml(docPath);
		if (!pomFolder) {
			return; // standalone project
		}
		const pomPath = path.join(pomFolder, 'pom.xml');

		KaotoOutputChannel.logInfo('Detected added steps on save. Updating Camel dependencies...');
		await (await CamelDependencyUpdateJBangTask.create(pomPath, docPath)).executeAndWaitWithProgress('Updating Camel dependencies in pom.xml');
		KaotoOutputChannel.logInfo('Camel dependencies update completed.');
	}
}
