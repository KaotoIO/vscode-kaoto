/**
 * Copyright 2024 Red Hat, Inc. and/or its affiliates.
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
'use strict';

import { ShellExecution, Task, TaskDefinition, tasks, TaskScope, WorkspaceFolder } from 'vscode';

/**
 * This class represents implementation of vscode.task for Camel JBang.
 */
export abstract class CamelJBangTask extends Task {

	protected label: string;

	constructor(scope: WorkspaceFolder | TaskScope.Workspace, label: string, shellExecution: ShellExecution) {

		const taskDefinition: TaskDefinition = {
			'label': label,
			'type': 'shell'
		};

		super(
			taskDefinition,
			scope,
			label,
			'camel',
			shellExecution
		);
		this.label = label;
	}

	/**
	 * Execute and wait till the end of the task
	 */
	public async execute(): Promise<void> {
		await tasks.executeTask(this);
		return await this.waitForEnd();
	}

	/**
	 * Execute without waiting for end of the task
	 */
	public async executeOnly(): Promise<void> {
		await tasks.executeTask(this);
	}

	private async waitForEnd(): Promise<void> {
		await new Promise<void>(resolve => {
			const disposable = tasks.onDidEndTask(e => {
				if (e.execution.task.name === this.label) {
					disposable.dispose();
					resolve();
				}
			});
		});
	}

}
