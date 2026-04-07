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
import { ShellExecution, TaskScope } from 'vscode';
import { CamelTask } from './CamelTask';
import { basename, dirname } from 'path';
import { CamelCommandAPI } from '../executors/api/CamelCommandAPI';

export class CamelKubernetesRunTask extends CamelTask {
	private constructor(shellExecution: ShellExecution, filePath: string) {
		super(TaskScope.Workspace, `Deploying - ${basename(filePath)}`, shellExecution);
	}

	static async create(filePath: string): Promise<CamelKubernetesRunTask> {
		const result = await CamelCommandAPI.kubernetesRun(filePath, dirname(filePath));
		return new CamelKubernetesRunTask(result.execution, filePath);
	}
}
