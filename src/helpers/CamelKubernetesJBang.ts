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
import { ShellExecution, ShellExecutionOptions, Uri, workspace } from 'vscode';
import { CamelJBang } from './CamelJBang';
import { KAOTO_CAMEL_JBANG_KUBERNETES_RUN_ARGUMENTS_SETTING_ID } from './helpers';

/**
 * Camel JBang class which allows shell execution of different JBang CLI commands
 */
export class CamelKubernetesJBang extends CamelJBang {
	public async export(uri: Uri, gav: string, runtime: string, outputPath: string, cwd: string): Promise<ShellExecution> {
		// export the project with the kubernetes plugin
		return await super.export(uri, gav, runtime, outputPath, cwd, true);
	}

	public async run(filePattern: string, cwd?: string): Promise<ShellExecution> {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: cwd,
		};
		return new ShellExecution(
			this.jbang,
			[...this.defaultJbangArgs, 'kubernetes', 'run', filePattern, this.getCamelVersion(), ...this.getKubernetesRunArguments()].filter(function (arg) {
				return arg !== undefined && arg !== null && arg !== ''; // remove ALL empty values ("", null, undefined and 0)
			}), // remove ALL empty values ("", null, undefined and 0)
			shellExecOptions,
		);
	}

	protected getKubernetesRunArguments(): string[] {
		const kubernetesRunArgs = workspace.getConfiguration().get(KAOTO_CAMEL_JBANG_KUBERNETES_RUN_ARGUMENTS_SETTING_ID) as string[];
		if (kubernetesRunArgs.length > 0) {
			return kubernetesRunArgs;
		} else {
			return [];
		}
	}
}
