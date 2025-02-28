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
import { Uri, commands } from 'vscode';
import { AbstractNewCamelRouteCommand } from './AbstractNewCamelRouteCommand';
import { CamelBindJBangTask } from '../tasks/CamelBindJBangTask';
import { CamelRouteDSL } from './AbstractCamelCommand';
import path from 'path';

export class NewCamelPipeCommand extends AbstractNewCamelRouteCommand {
	public static readonly ID_COMMAND_CAMEL_PIPE_YAML = 'kaoto.camel.jbang.init.pipe.yaml';
	protected static readonly PROGRESS_NOTIFICATION_MESSAGE = 'Creating a new Pipe file...';

	public async create(): Promise<void> {
		const wsFolder = await this.showWorkspaceFolderPick();
		if (wsFolder || this.singleWorkspaceFolder) {
			const targetFolder = await this.showDialogToPickFolder(wsFolder?.uri);
			if (targetFolder) {
				const name = await this.showInputBoxForFileName(targetFolder ? targetFolder.fsPath : undefined);
				if (name && this.camelDSL && this.singleWorkspaceFolder) {
					const fileName = this.getFullName(name, this.camelDSL.extension);
					const filePath = this.computeFullPath(targetFolder.fsPath, fileName);

					const wsFolderTarget = wsFolder || this.singleWorkspaceFolder;
					await new CamelBindJBangTask(wsFolderTarget, path.relative(wsFolderTarget.uri.fsPath, filePath)).executeAndWaitWithProgress(
						NewCamelPipeCommand.PROGRESS_NOTIFICATION_MESSAGE,
					);

					const targetFileURI = Uri.file(filePath);
					await this.waitForFileExists(targetFileURI);
					await commands.executeCommand('kaoto.open', targetFileURI);
				}
			}
		} else {
			await this.showNoWorkspaceNotification();
		}
	}

	protected getDSL(dsl: string): CamelRouteDSL | undefined {
		if (dsl === 'YAML') {
			return { language: 'YAML', extension: 'pipe.yaml', placeHolder: 'example' };
		} else {
			return undefined;
		}
	}
}
