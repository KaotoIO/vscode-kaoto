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
import { ShellExecution, TaskRevealKind, TaskScope, WorkspaceFolder } from 'vscode';
import { CamelJBangTask } from './CamelJBangTask';
import { CamelCommandAPI } from '../executors/api/CamelCommandAPI';

export class CamelBindJBangTask extends CamelJBangTask {
	private constructor(scope: WorkspaceFolder | TaskScope.Workspace, shellExecution: ShellExecution) {
		super(scope, 'Init a Camel file with JBang', shellExecution, true, TaskRevealKind.Silent);
	}

	static async create(
		scope: WorkspaceFolder | TaskScope.Workspace,
		file: string,
		source: string = 'timer-source',
		sink: string = 'log-sink',
	): Promise<CamelBindJBangTask> {
		const result = await CamelCommandAPI.bind(file, source, sink);
		return new CamelBindJBangTask(scope, result.execution);
	}
}
