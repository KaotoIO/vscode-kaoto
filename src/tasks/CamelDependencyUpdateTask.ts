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
import { ShellExecution, TaskRevealKind, TaskScope } from 'vscode';
import { CamelTask } from './CamelTask';
import { CamelCommandAPI } from '../executors/api/CamelCommandAPI';
import path from 'path';

export class CamelDependencyUpdateTask extends CamelTask {
	private constructor(shellExecution: ShellExecution) {
		super(TaskScope.Workspace, 'Update Camel dependencies in pom.xml', shellExecution, true, TaskRevealKind.Silent);
	}

	static async create(pomPath: string, integrationFilePath: string): Promise<CamelDependencyUpdateTask> {
		const result = await CamelCommandAPI.dependencyUpdate(pomPath, integrationFilePath, path.dirname(pomPath));
		return new CamelDependencyUpdateTask(result.execution);
	}
}
