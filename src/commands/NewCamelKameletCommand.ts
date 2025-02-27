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
import { QuickPickItem, Uri, commands, window } from "vscode";
import { AbstractNewCamelRouteCommand } from "./AbstractNewCamelRouteCommand";
import { CamelInitJBangTask } from "../tasks/CamelInitJBangTask";
import { CamelRouteDSL } from "./AbstractCamelCommand";
import path from "path";

export class NewCamelKameletCommand extends AbstractNewCamelRouteCommand {

	public static readonly ID_COMMAND_CAMEL_KAMELET_YAML = 'kaoto.camel.jbang.init.kamelet.yaml';
	protected static readonly PROGRESS_NOTIFICATION_MESSAGE = 'Creating a new Kamelet file...';

	private kameletType: string = '';

	public async create(): Promise<void> {
		const wsFolder = await this.showWorkspaceFolderPick();
		if (wsFolder || this.singleWorkspaceFolder) {
			const targetFolder = await this.showDialogToPickFolder(wsFolder?.uri);
			if (targetFolder) {
				const type = await this.showQuickPickForKameletType();
				if (type) {
					this.kameletType = type.label;
					const name = await this.showInputBoxForFileName(targetFolder ? targetFolder.fsPath : undefined);
					if (name && this.camelDSL && this.singleWorkspaceFolder) {
						const fileName = this.getKameletFullName(name, this.kameletType, this.camelDSL.extension);
						const filePath = this.computeFullPath(targetFolder.fsPath, fileName);

						const wsFolderTarget = wsFolder || this.singleWorkspaceFolder;
						await new CamelInitJBangTask(wsFolderTarget, path.relative(wsFolderTarget.uri.fsPath, filePath)).executeAndWaitWithProgress(NewCamelKameletCommand.PROGRESS_NOTIFICATION_MESSAGE);
						const targetFileURI = Uri.file(filePath);
						await this.waitForFileExists(targetFileURI);
						await commands.executeCommand('kaoto.open', targetFileURI);
					}
				}
			}
		} else {
			await this.showNoWorkspaceNotification();
		}
	}

	protected getDSL(dsl: string): CamelRouteDSL | undefined {
		if (dsl === 'YAML') {
			return { language: 'YAML', extension: 'kamelet.yaml', placeHolder: 'example' };
		} else {
			return undefined;
		}
	}

	protected async showInputBoxForFileName(targetFolder?: string): Promise<string> {
		return await window.showInputBox({
			prompt: this.fileNameInputPrompt,
			placeHolder: this.camelDSL?.placeHolder,
			validateInput: (fileName) => {
				return this.validateCamelFileName(`${fileName}-${this.kameletType}`, targetFolder);
			},
		}) ?? '';
	}

	protected async showQuickPickForKameletType(): Promise<QuickPickItem | undefined> {
		const items: QuickPickItem[] = [
			{ label: 'source', description: 'A route that produces data.', detail: 'You use a source Kamelet to retrieve data from a component.', },
			{ label: 'sink', description: 'A route that consumes data.', detail: 'You use a sink Kamelet to send data to a component.' },
			{ label: 'action', description: 'A route that performs an action on data.', detail: 'You can use an action Kamelet to manipulate data when it passes from a source Kamelet to a sink Kamelet.' }
		];
		return await window.showQuickPick(items, {
			placeHolder: 'Please select a Kamelet type.',
		});
	}

	protected getKameletFullName(name: string, type: string, suffix: string): string {
		return `${name}-${type}.${suffix}`;
	}
}
