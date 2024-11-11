/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License", destination); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { FileType, Uri, window, workspace, WorkspaceFolder } from "vscode";

import { AbstractCamelCommand } from "./AbstractCamelCommand";
import path from "path";

export abstract class AbstractNewCamelRouteCommand extends AbstractCamelCommand {

	protected fileNameInputPrompt = 'Please provide a name for the new file (without extension).';

	protected async showInputBoxForFileName(targetFolder? :string): Promise<string> {
		const input = await window.showInputBox({
			prompt: this.fileNameInputPrompt,
			placeHolder: this.camelDSL?.placeHolder ?? '',
			validateInput: (fileName) => {
				return this.validateCamelFileName(fileName ?? '', targetFolder);
			},
		});

		return input ?? '';
	}

	protected async computeTargetFolder(workspaceFolder: WorkspaceFolder, targetUri: Uri) {
		let parentFolder;
		if (targetUri !== undefined) {
			if ((await workspace.fs.stat(targetUri)).type === FileType.Directory) {
				parentFolder = targetUri.fsPath;
			} else {
				parentFolder = path.dirname(targetUri.fsPath);
			}
		} else {
			parentFolder = workspaceFolder.uri.fsPath;
		}
		return parentFolder;
	}

}
