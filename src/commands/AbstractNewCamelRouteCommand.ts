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
import { Uri, window } from "vscode";
import { AbstractCamelCommand } from "./AbstractCamelCommand";

export abstract class AbstractNewCamelRouteCommand extends AbstractCamelCommand {

	protected fileNameInputPrompt = 'Please provide a name for the new file (without extension).';

	protected async showInputBoxForFileName(targetFolder?: string): Promise<string> {
		const input = await window.showInputBox({
			prompt: this.fileNameInputPrompt,
			placeHolder: this.camelDSL?.placeHolder ?? '',
			validateInput: (fileName) => {
				return this.validateCamelFileName(fileName ?? '', targetFolder);
			},
		});

		return input ?? '';
	}

	protected async showDialogToPickFolder(): Promise<Uri | undefined> {
		const selectedFolders = await window.showOpenDialog(
			{
				canSelectMany: false,
				canSelectFolders: true,
				canSelectFiles: false,
				openLabel: 'Select',
				title: 'Select a folder to create the file in. ESC to cancel a file creation.',
				defaultUri: this.workspaceFolder?.uri
			});
		if (selectedFolders !== undefined) {
			return selectedFolders[0];
		}
		return undefined;
	}

}
