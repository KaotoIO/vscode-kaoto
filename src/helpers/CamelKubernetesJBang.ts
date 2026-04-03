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

	public async run(filePattern: string, cwd?: string, _port?: number): Promise<{ execution: ShellExecution; resolvedPort: number }> {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: cwd,
		};
		const kubernetesRunArgs = this.getKubernetesRunArguments();
		const { argument: camelVersionArg, conflicts: camelVersionConflicts } = this.getCamelVersion(kubernetesRunArgs, 'kubernetes-run');
		const { argument: reposArg, conflicts: reposConflicts } = this.getRedHatMavenRepository(kubernetesRunArgs, 'kubernetes-run');

		// Show warnings for conflicts
		await this.showConflictWarnings([...camelVersionConflicts, ...reposConflicts]);

		const execution = new ShellExecution(
			this.jbang,
			this.filterEmptyArgs([...this.defaultJbangArgs, 'kubernetes', 'run', filePattern, camelVersionArg, reposArg, ...kubernetesRunArgs]),
			shellExecOptions,
		);

		// Kubernetes deployments don't use local ports in the same way
		// Return NO_PORT to indicate no local port monitoring needed
		return { execution, resolvedPort: CamelJBang.NO_PORT };
	}

	protected getKubernetesRunArguments(): string[] {
		const kubernetesRunArgs = workspace.getConfiguration().get(KAOTO_CAMEL_JBANG_KUBERNETES_RUN_ARGUMENTS_SETTING_ID) as string[];
		// No hardcoded arguments to merge for kubernetes run currently
		// If needed in the future, use ArgumentConflictDetector.mergeArguments here
		if (kubernetesRunArgs.length > 0) {
			return kubernetesRunArgs;
		} else {
			return [];
		}
	}
}
