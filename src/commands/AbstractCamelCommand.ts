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

import fs from 'fs';
import { WorkspaceFolder, workspace } from "vscode";
import isValidFilename from 'valid-filename'
import path from 'path';

export interface CamelRouteDSL {
	language: string;
	extension: string;
	placeHolder: string;
}

export abstract class AbstractCamelCommand {

	protected workspaceFolder: WorkspaceFolder | undefined;
	protected camelDSL: CamelRouteDSL | undefined;

	constructor(dsl: string) {
		this.camelDSL = this.getDSL(dsl);
		this.workspaceFolder = this.getWorkspaceFolder();
	}

	protected getDSL(dsl: string): CamelRouteDSL | undefined {
		switch (dsl) {
			case 'YAML':
				return { language: 'Yaml', extension: 'camel.yaml', placeHolder: 'sample-route' };
			default:
				return undefined;
		}
	}

	/**
	 * Resolves first opened folder in vscode existing workspace
	 *
	 * @returns WorkspaceFolder object
	 */
	private getWorkspaceFolder(): WorkspaceFolder | undefined {
		let workspaceFolder: WorkspaceFolder | undefined;
		if (workspace.workspaceFolders) {
			// default to root workspace folder
			workspaceFolder = workspace.workspaceFolders[0];
		}
		return workspaceFolder;
	}

	/**
	 * Camel file name validation
	 *  - no empty name
	 *  - name without extension
	 *  - file already exists check
	 *  - name cannot contains eg. special characters
	 *  - Java pattern naming convention \b[A-Z][a-zA-Z_$0-9]*
	 *
	 * @param name
	 * @returns string | undefined
	 */
		public validateCamelFileName(name: string, folderPath?: string): string | undefined {
			if (!name) {
				return 'Please provide a name for the new file (without extension).';
			}

			if (name.includes('.')) {
				return 'Please provide a name without the extension.';
			}

			if (!this.camelDSL) {
				return 'Internal error: Camel DSL is undefined.'; // camelDSL can't be undefined
			}

			if (!this.workspaceFolder) {
				return 'Internal error: Workspace folder is undefined.';
			}

			const newFilePotentialFullPath: string = this.computeFullPath(folderPath ?? this.workspaceFolder.uri.fsPath, this.getFullName(name, this.camelDSL.extension));
			if (fs.existsSync(newFilePotentialFullPath)) {
				return 'The file already exists. Please choose a different file name.';
			}
			if (!isValidFilename(name)) {
				return 'The filename is invalid.';
			}

			const patternJavaNamingConvention = '\\b[A-Z][a-zA-Z_$0-9]*';
			if ((this.camelDSL.language === 'Java') && (!name.match(patternJavaNamingConvention) || name.includes(' '))) {
				return `The filename needs to follow the ${this.camelDSL.language} naming convention. I.e. ${patternJavaNamingConvention}`;
			}
			return undefined;
		}

		/**
		 * Get the full file name for provided name and suffix
		 *
		 * @param name of the file
		 * @param suffix of the file
		 * @returns the full file name format [name.suffix] eg. foo.yaml
		 */
		protected getFullName(name: string, suffix: string): string {
			return `${name}.${suffix}`;
		}

		/**
		 * Resolves absolute path for the given workspace and file
		 *
		 * @param folderPath
		 * @param file
		 * @returns absolute string Path
		 */
		protected computeFullPath(folderPath: string, file: string): string {
			return path.join(folderPath, file);
		}

}
