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
import { RelativePattern, ShellExecution, ShellExecutionOptions, Uri, workspace } from 'vscode';
import { arePathsEqual } from './helpers';
import { dirname } from 'path';

export enum RouteOperation {
	start = 'start',
	stop = 'stop',
	suspend = 'suspend',
	resume = 'resume',
}

/**
 * Camel JBang class which allows shell execution of different JBang CLI commands
 */
export class CamelJBang {
	private readonly camelJBangVersion: string;
	private readonly defaultJbangArgs: string[];

	constructor(private readonly jbang: string = 'jbang') {
		this.camelJBangVersion = workspace.getConfiguration().get('kaoto.camelJBang.Version') as string;
		this.defaultJbangArgs = [`'-Dcamel.jbang.version=${this.camelJBangVersion}'`, 'camel@apache/camel'];
	}

	public add(plugin: string): ShellExecution {
		return new ShellExecution(this.jbang, [...this.defaultJbangArgs, 'plugin', 'add', plugin]);
	}

	public init(file: string): ShellExecution {
		return new ShellExecution(this.jbang, [...this.defaultJbangArgs, 'init', `'${file}'`]);
	}

	public bind(file: string, source: string, sink: string): ShellExecution {
		return new ShellExecution(this.jbang, [...this.defaultJbangArgs, 'bind', '--source', source, '--sink', sink, `'${file}'`]);
	}

	public export(filePath: string, gav: string, runtime: string, outputPath: string): ShellExecution {
		// workaround for an issue during Camel JBang execution in Windows machines.
		// specifying the --directory option with the complete path when it is equal to the current working directory causes issues.
		// omitting the option (using default '.') works as expected.
		const directoryArg = arePathsEqual(dirname(filePath), outputPath) ? '' : `'--directory=${outputPath}'`;

		return new ShellExecution(
			this.jbang,
			[...this.defaultJbangArgs, 'export', `'${filePath}'`, `--runtime=${runtime}`, `--gav=${gav}`, directoryArg].filter(function (arg) {
				return arg; // remove ALL empty values ("", null, undefined and 0)
			}),
		);
	}

	public async run(filePath: string, cwd?: string, port?: number): Promise<ShellExecution> {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: cwd,
		};
		const runArgs = await this.getRunArguments(filePath);
		return new ShellExecution(
			this.jbang,
			[
				...this.defaultJbangArgs,
				'run',
				`'${filePath}'`,
				'--console',
				`--port=${port ?? 8080}`,
				...runArgs,
				this.getCamelVersion(),
				this.getRedHatMavenRepository(),
			].filter(function (arg) {
				return arg; // remove ALL empty values ("", null, undefined and 0)
			}),
			shellExecOptions,
		);
	}

	public kubernetesRun(filePattern: string, cwd?: string): ShellExecution {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: cwd,
		};
		return new ShellExecution(
			this.jbang,
			[...this.defaultJbangArgs, 'kubernetes', 'run', filePattern, this.getCamelVersion(), ...this.getKubernetesRunArguments()].filter(function (arg) {
				return arg;
			}), // remove ALL empty values ("", null, undefined and 0)
			shellExecOptions,
		);
	}

	public stop(name: string): ShellExecution {
		return new ShellExecution(this.jbang, [...this.defaultJbangArgs, 'stop', name]);
	}

	private getKubernetesRunArguments(): string[] {
		const kubernetesRunArgs = workspace.getConfiguration().get('kaoto.camelJBang.KubernetesRunArguments') as string[];
		if (kubernetesRunArgs) {
			return kubernetesRunArgs;
		} else {
			return [];
		}
	}

	private async getRunArguments(filePath: string): Promise<string[]> {
		const runArgs = workspace.getConfiguration().get('kaoto.camelJBang.RunArguments') as string[];
		if (runArgs) {
			return await this.handleMissingXslFiles(filePath, runArgs);
		} else {
			return [];
		}
	}

	private getCamelVersion(): string {
		const camelVersion = workspace.getConfiguration().get('kaoto.camelVersion');
		if (camelVersion) {
			return `--camel-version=${camelVersion as string}`;
		} else {
			return '';
		}
	}

	private getRedHatMavenRepository(): string {
		if (this.getCamelVersion().includes('redhat')) {
			const url = workspace.getConfiguration().get('kaoto.camelJBang.redHatMavenRepository') as string;
			const reposPlaceholder = this.getCamelGlobalRepos();
			return url ? `--repos=${reposPlaceholder}${url}` : '';
		} else {
			return '';
		}
	}

	private getCamelGlobalRepos(): string {
		const globalRepos = workspace.getConfiguration().get('kaoto.camelJBang.redHatMavenRepository.global') as boolean;
		if (globalRepos) {
			return '#repos,';
		} else {
			return '';
		}
	}

	/**
	 * Mainly in ZSH shell there is problem when Camel JBang is executed with non existing files added using '*.xsl' file pattern
	 * it is caused by null glob option disabled by default for ZSH shell
	 */
	private async handleMissingXslFiles(filePath: string, runArgs: string[]): Promise<string[]> {
		const folderUri = Uri.file(dirname(filePath));
		const xsls = await workspace.findFiles(new RelativePattern(folderUri, '*.xsl'));
		if (xsls.length > 0) {
			return runArgs; // don't modify default run arguments specified via settings which should by default contain *.xsl
		} else {
			return runArgs.filter((parameter) => parameter !== '*.xsl');
		}
	}
}
