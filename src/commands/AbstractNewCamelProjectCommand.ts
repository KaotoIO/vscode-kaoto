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
import * as path from "path";
import { TaskScope, Uri, commands, window, workspace } from "vscode";
import { CamelExportJBangTask } from "../tasks/CamelExportJBangTask";
import { arePathsEqual, getCurrentWorkingDirectory } from "../helpers/helpers";

export abstract class AbstractNewCamelProjectCommand {

	async create() {
		const runtime = await this.getRuntime();
		const input = await this.askForGAV();
		if (runtime && input) {

			// Uses the user selected folder otherwise default to the root workspace folder
			const outputFolder = await this.showDialogToPickFolder();
			if (!outputFolder) {
				await window.showErrorMessage('Camel project creation canceled or invalid folder selection');
				return;
			}

			// If the chosen output folder is different from the first folder from the current workspace warns the user about
			// potentially deleting files in the selected folder.
			// Executing the command from the same folder does not delete files.
			const cwd = getCurrentWorkingDirectory();
			if (cwd && !arePathsEqual(cwd, outputFolder.fsPath)){
				const userChoice = await this.confirmDestructiveActionInSelectedFolder(outputFolder.fsPath);

				if (userChoice === undefined){
					await window.showInformationMessage('Camel project creation canceled');
					return;
				}
			}

			await new CamelExportJBangTask(TaskScope.Workspace, input, runtime, outputFolder.fsPath).execute();

			// if not exist, init .vscode with tasks.json and launch.json config files
			await workspace.fs.createDirectory(Uri.file(path.join(outputFolder.fsPath, '.vscode')));
			for (const filename of ['tasks', 'launch']) {
				await this.copyFile(`../../../resources/${runtime}/${filename}.json`, path.join(outputFolder.fsPath, `.vscode/${filename}.json`));
			}

			// open the newly created project in a new vscode instance
			await commands.executeCommand('vscode.openFolder', outputFolder, true);
		}
	}

	abstract getRuntime(): Promise<string|undefined>;

	async askForGAV() {
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
	public validateGAV(name: string): string | undefined {
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
			return 'The group id cannot start with a .';
		}
		for (const groupidSubPart of groupIdSplit) {
			const regExpSearch = /^[a-z]\w*$/.exec(groupidSubPart);
			if (regExpSearch === null || regExpSearch.length === 0) {
				return `Invalid subpart of group Id: ${groupidSubPart}} . It must follow groupId:artifactId:version pattern with group Id subpart separated by dot needs to follow this specific pattern: [a-zA-Z]\\w*`;
			}
		}

		const artifactId = gavs[1];
		const regExpSearchArtifactId = /^[a-zA-Z]\w*$/.exec(artifactId);
		if (regExpSearchArtifactId === null || regExpSearchArtifactId.length === 0) {
			return `Invalid artifact Id: ${artifactId}} . It must follow groupId:artifactId:version pattern with artifactId specific pattern: [a-zA-Z]\\w*`;
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
		const selectedFolders = await window.showOpenDialog(
			{
				canSelectMany: false,
				canSelectFolders: true,
				canSelectFiles: false,
				openLabel: 'Select',
				title: 'Select a folder to create the project in. ESC to cancel the project creation'
			});
		if (selectedFolders !== undefined) {
			return selectedFolders[0];
		}
		return undefined;
	}

	/**
	 * Handles copy of the resources from the extension to the vscode workspace
	 *
	 * @param sourcePath Path of source
	 * @param destPath Path of destination
	 */
	private async copyFile(sourcePath: string, destPath: string): Promise<void> {

		const sourcePathUri = Uri.file(path.resolve(__dirname, sourcePath));
		const destPathUri = Uri.file(path.resolve(__dirname, destPath));
		try {
			await workspace.fs.copy(sourcePathUri, destPathUri, { overwrite: false });
		} catch (error) {
			// Do nothing in case there already exists tasks.json and launch.json files
		}

	}

	/**
	 * Shows a modal asking for user confirmation of a potential destructive action in the selected folder.
	 * VSCode automatically provides a 'Cancel' option which return `undefined`. The continue option will return the string `Continue`.
	 *
	 * @param outputPath path to be shown in the warning message.
	 *
	 * @returns string | undefined
	 */
	private async confirmDestructiveActionInSelectedFolder(outputPath: string) {
		const message = `Files in the folder: ${outputPath} WILL BE DELETED before project creation, continue?`;
		const continueOption = 'Continue';

		return await window.showWarningMessage(message, { modal: true }, continueOption);

	}
}
