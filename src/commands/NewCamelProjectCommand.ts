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
import { commands, QuickPickItem, Uri, window, workspace } from 'vscode';
import { arePathsEqual } from '../helpers/helpers';
import { CamelExportJBangTask } from '../tasks/CamelExportJBangTask';
import { confirmDestructiveActionInSelectedFolder } from '../helpers/modals';

export class NewCamelProjectCommand {
	public static readonly ID_COMMAND_CAMEL_NEW_PROJECT = 'kaoto.camel.jbang.export';

	public async create(uri: Uri) {
		const runtime = await this.askForRuntime();
		if (!runtime) {
			return;
		}
		const input = await this.askForGAV();
		if (input) {
			const outputFolder = await this.showDialogToPickFolder();
			if (!outputFolder) {
				return;
			}

			// if the chosen output folder is different from the first folder from the current workspace warns the user about potentially deleting files in the selected folder.
			// executing the command from the same folder does not delete files.
			const currentWorkspace = workspace.getWorkspaceFolder(uri);
			if (currentWorkspace) {
				if (!arePathsEqual(currentWorkspace.uri.fsPath, outputFolder.fsPath)) {
					const userChoice = await confirmDestructiveActionInSelectedFolder(outputFolder.fsPath);
					if (userChoice === undefined) {
						// project creation canceled
						return;
					}
				}
				await new CamelExportJBangTask(currentWorkspace, uri.fsPath, input, runtime, outputFolder.fsPath).executeAndWaitWithProgress(
					'Creating a new Camel project...',
				);

				// open the newly created project in a new vscode instance
				await commands.executeCommand('vscode.openFolder', outputFolder, true);
			}
		}
	}

	private async askForRuntime(): Promise<string | undefined> {
		const selection = await this.showQuickPickForCamelRuntime();
		return selection?.label;
	}

	private async askForGAV() {
		return await window.showInputBox({
			prompt: 'Please provide repository coordinate',
			placeHolder: 'com.acme:myproject:1.0-SNAPSHOT',
			value: 'com.acme:myproject:1.0-SNAPSHOT',
			validateInput: (gav) => {
				return this.validateGAV(gav);
			},
		});
	}

	/**
	 * Maven GAV validation
	 * 	- no empty name
	 *  - Have 2 double-dots (similar check than Camel JBang)
	 *  - following mostly recommendations from Maven Central for name rules
	 *
	 * @param name
	 * @returns string | undefined
	 */
	private validateGAV(name: string): string | undefined {
		if (!name) {
			return 'Please provide a GAV for the new project following groupId:artifactId:version pattern.';
		}
		if (name.includes(' ')) {
			return 'The GAV cannot contain a space. It must constituted from groupId, artifactId and version following groupId:artifactId:version pattern.';
		}
		const gavs = name.split(':');
		if (gavs.length !== 3) {
			return 'The GAV needs to have double-dot `:` separator and constituted from groupId, artifactId and version';
		}
		const groupIdSplit = gavs[0].split('.');
		if (groupIdSplit[0].length === 0) {
			return 'The groupId cannot start with a .';
		}
		for (const groupIdSubPart of groupIdSplit) {
			const regExpSearch = /^[a-z]\w*$/.exec(groupIdSubPart);
			if (regExpSearch === null || regExpSearch.length === 0) {
				return `Invalid subpart of groupId: ${groupIdSubPart}} . It must follow groupId:artifactId:version pattern with groupId subpart separated by dot needs to follow this specific pattern: [a-zA-Z]\\w*`;
			}
		}

		const artifactId = gavs[1];
		const regExpSearchArtifactId = /^[a-zA-Z]\w*$/.exec(artifactId);
		if (regExpSearchArtifactId === null || regExpSearchArtifactId.length === 0) {
			return `Invalid artifactId: ${artifactId}} . It must follow groupId:artifactId:version pattern with artifactId specific pattern: [a-zA-Z]\\w*`;
		}

		const version = gavs[2];
		const regExpSearch = /^\d[\w-.]*$/.exec(version);
		if (regExpSearch === null || regExpSearch.length === 0) {
			return `Invalid version: ${version} . It must follow groupId:artifactId:version pattern with version specific pattern: \\d[\\w-.]*`;
		}
		return undefined;
	}

	/**
	 * Open a dialog to select a folder to create the project in.
	 *
	 * @returns Uri of the selected folder or undefined if canceled by the user.
	 */
	private async showDialogToPickFolder(): Promise<Uri | undefined> {
		const selectedFolders = await window.showOpenDialog({
			canSelectMany: false,
			canSelectFolders: true,
			canSelectFiles: false,
			openLabel: 'Select',
			title: 'Select a folder to create the project in. ESC to cancel the project creation',
		});
		if (selectedFolders !== undefined) {
			return selectedFolders[0];
		}
		return undefined;
	}

	/**
	 * Open a quick pick dialog for a Camel Runtime selection
	 *
	 * @returns label of a selected Camel runtime: `quarkus` or `spring-boot`
	 */
	private async showQuickPickForCamelRuntime(): Promise<QuickPickItem | undefined> {
		const items: QuickPickItem[] = [
			{ label: 'quarkus', description: 'Camel Quarkus' },
			{ label: 'spring-boot', description: 'Camel on Spring Boot' },
		];
		return await window.showQuickPick(items, {
			placeHolder: 'Please select a Camel Runtime.',
			title: 'Runtime selection...',
		});
	}
}
