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
import { ShellExecution, ShellExecutionOptions } from 'vscode';
import { CamelJBang } from './CamelJBang';

export class CamelTestJBang extends CamelJBang {
	constructor(jbang: string = 'jbang') {
		super(jbang);
	}

	public init(file: string, cwd?: string): ShellExecution {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: cwd ?? undefined,
		};
		return new ShellExecution(this.jbang, [...this.defaultJbangArgs, 'test', 'init', `'${file}'`], shellExecOptions);
	}

	public async run(filePath: string, cwd: string): Promise<ShellExecution> {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: cwd,
		};
		return new ShellExecution(
			this.jbang,
			[...this.defaultJbangArgs, 'test', 'run', `'${filePath}'`].filter(function (arg) {
				return arg !== undefined && arg !== null && arg !== ''; // remove ALL empty values ("", null, undefined and 0)
			}),
			shellExecOptions,
		);
	}

	public async runFolder(cwd: string): Promise<ShellExecution> {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: cwd,
		};
		return new ShellExecution(
			this.jbang,
			[...this.defaultJbangArgs, 'test', 'run', '*'].filter(function (arg) {
				return arg !== undefined && arg !== null && arg !== ''; // remove ALL empty values ("", null, undefined and 0)
			}),
			shellExecOptions,
		);
	}
}
