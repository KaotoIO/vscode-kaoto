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
import { CamelInitTask } from './CamelInitTask';
import { WorkspaceFolder, TaskScope } from 'vscode';
import { CamelCommandAPI } from '../executors/api/CamelCommandAPI';

export class CamelTestInitTask extends CamelInitTask {
	private cwd: string;

	protected constructor(scope: WorkspaceFolder | TaskScope.Workspace, label: string, shellExecution: any, cwd: string) {
		super(scope, label, shellExecution);
		this.cwd = cwd;
	}

	static async create(
		file: string,
		scope: WorkspaceFolder | TaskScope.Workspace,
		label: string = 'Init a Camel Test file',
		cwd?: string,
	): Promise<CamelTestInitTask> {
		const result = await CamelCommandAPI.testInit(file, cwd);
		return new CamelTestInitTask(scope, label, result.execution, cwd || '');
	}
}
