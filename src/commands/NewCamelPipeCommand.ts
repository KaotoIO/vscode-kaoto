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

import { Uri, commands, window } from "vscode";
import { AbstractNewCamelRouteCommand } from "./AbstractNewCamelRouteCommand";
import { CamelBindJBangTask } from "../tasks/CamelBindJBangTask";
import { CamelRouteDSL } from "./AbstractCamelCommand";
import path from "path";

export class NewCamelPipeCommand extends AbstractNewCamelRouteCommand {

	public static readonly ID_COMMAND_CAMEL_ROUTE_PIPE_YAML = 'camel.jbang.routes.pipe.yaml';

	public async create(targetFolder: Uri): Promise<void> {
		const name = await this.showInputBoxForFileName(targetFolder ? targetFolder.fsPath : undefined);
		if (name && this.camelDSL && this.workspaceFolder) {
			const fileName = this.getPipeFullName(name, this.camelDSL.extension);
			const parentFolder = await this.computeTargetFolder(this.workspaceFolder, targetFolder);
			const filePath = this.computeFullPath(parentFolder, fileName);

			await new CamelBindJBangTask(this.workspaceFolder, path.relative(this.workspaceFolder.uri.fsPath, filePath)).execute();
			await commands.executeCommand('vscode.open', Uri.file(filePath));
		}
	}

	protected getDSL(dsl: string): CamelRouteDSL | undefined {
		if (dsl === 'YAML') {
			return { language: 'Yaml', extension: 'yaml', placeHolder: 'example' };
		} else {
			return undefined;
		}
	}

	protected async showInputBoxForFileName(targetFolder?: string): Promise<string> {
		return await window.showInputBox({
			prompt: this.fileNameInputPrompt,
			placeHolder: this.camelDSL?.placeHolder,
			validateInput: (fileName) => {
				return this.validateCamelFileName(`${fileName}-pipe`, targetFolder);
			},
		}) || '';
	}

	protected getPipeFullName(name: string, suffix: string): string {
		return `${name}-pipe.${suffix}`;
	}
}
