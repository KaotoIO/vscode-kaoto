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

import { commands, Uri } from 'vscode';
import { CamelInitJBangTask } from '../tasks/CamelInitJBangTask';
import { AbstractNewCamelRouteCommand } from './AbstractNewCamelRouteCommand';
import * as path from 'path';

export class NewCamelRouteCommand extends AbstractNewCamelRouteCommand {

	public static readonly ID_COMMAND_CAMEL_ROUTE_JBANG_YAML = 'camel.jbang.routes.yaml';

	public async create(targetFolder : Uri): Promise<void> {
		const input = await this.showInputBoxForFileName(targetFolder ? targetFolder.fsPath : undefined);
		if(input && this.camelDSL && this.workspaceFolder) {
			const fileName = this.getFullName(input, this.camelDSL.extension);
			const parentFolder = await this.computeTargetFolder(this.workspaceFolder, targetFolder);
			const filePath = this.computeFullPath(parentFolder, fileName);

			await new CamelInitJBangTask(this.workspaceFolder, path.relative(this.workspaceFolder.uri.fsPath, filePath)).execute();
			await commands.executeCommand('vscode.open', Uri.file(filePath));
		}
	}
}
