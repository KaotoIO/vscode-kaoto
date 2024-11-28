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
'use strict';

import { globSync } from "glob";
import { ShellExecution, ShellExecutionOptions, workspace, WorkspaceFolder } from "vscode";

/**
 * Camel JBang class which allows shell execution of different JBang CLI commands
 */
export class CamelJBang {

	private camelJBangVersion: string;

	constructor() {
		this.camelJBangVersion = workspace.getConfiguration().get('kaoto.camelJBang.Version') as string;
	}

	public init(file: string): ShellExecution {
		return new ShellExecution('jbang', [`'-Dcamel.jbang.version=${this.camelJBangVersion}'`, 'camel@apache/camel', 'init', `'${file}'`]);
	}

	public run(filePattern: string, cwd?: string): ShellExecution {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: cwd
		};
		return new ShellExecution('jbang', 
			[`'-Dcamel.jbang.version=${this.camelJBangVersion}'`,
				'camel@apache/camel',
				'run',
				filePattern,
				'--dev',
				'--logging-level=info',
				this.getCamelVersion(),
				this.getRedHatMavenRepository(),
				...this.getExtraLaunchParameter()
			].filter(function (arg) { return arg; }), // remove ALL empty values ("", null, undefined and 0)
			shellExecOptions
		);
	}

	public deploy(filePattern: string, cwd?: string): ShellExecution {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: cwd
		};
		return new ShellExecution('jbang', 
			[`'-Dcamel.jbang.version=${this.camelJBangVersion}'`,
				'camel@apache/camel',
				'kubernetes',
				'run',
				filePattern,
				this.getCamelVersion(),
				...this.getKubernetesExtraParameters()
			].filter(function (arg) { return arg; }), // remove ALL empty values ("", null, undefined and 0)
			shellExecOptions
		);
	}

	public bind(file: string, source: string, sink: string): ShellExecution {
		return new ShellExecution('jbang', [`'-Dcamel.jbang.version=${this.camelJBangVersion}'`, 'camel@apache/camel', 'bind', '--source', source, '--sink', sink, `'${file}'`]);
	}

	public createProject(gav: string, runtime: string): ShellExecution {
		return new ShellExecution('jbang', [`'-Dcamel.jbang.version=${this.camelJBangVersion}'`, 'camel@apache/camel', 'export', `--runtime=${runtime}`, `--gav=${gav}`]);
	}

	public add(plugin: string): ShellExecution {
		return new ShellExecution('jbang',
			[`'-Dcamel.jbang.version=${this.camelJBangVersion}'`,
				'camel@apache/camel',
				'plugin',
				'add',
				plugin]);
	}

	private getCamelVersion(): string {
		const camelVersion = workspace.getConfiguration().get('kaoto.camelVersion');
		if (camelVersion) {
			return `--camel-version=${camelVersion as string}`;
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

	private getRedHatMavenRepository(): string {
		if (this.getCamelVersion().includes('redhat')) {
			const url = workspace.getConfiguration().get('kaoto.camelJBang.RedHatMavenRepository') as string;
			const reposPlaceholder = this.getCamelGlobalRepos();
			return url ? `--repos=${reposPlaceholder}${url}` : '';
		} else {
			return '';
		}
	}

	private getExtraLaunchParameter(): string[] {
		const extraLaunchParameter = workspace.getConfiguration().get('kaoto.camelJBang.ExtraLaunchParameter') as string[];
		if (extraLaunchParameter) {
			return this.handleMissingXslFiles(extraLaunchParameter);;
		} else {
			return [];
		}
	}

	/**
	 * Mainly in ZSH shell there is problem when camel jbang is executed with non existing files added using '*.xsl' file pattern
	 * it is caused by ZSH null glob option disabled by default for ZSH shell
	 */
	private handleMissingXslFiles(extraLaunchParameters: string[]): string[] {
		const xsls = globSync(`${(workspace.workspaceFolders as WorkspaceFolder[])[0].uri.path}/**/*.xsl`).length > 0;
		if (xsls) {
			return extraLaunchParameters; // don't modify default extra launch parameters specified via settings which should by default contain *.xsl
		} else {
			return extraLaunchParameters.filter(parameter => parameter !== '*.xsl');
		}
	}

	private getKubernetesExtraParameters(): string[] {
		const extraParameters = workspace.getConfiguration().get('kaoto.camelJBang.KubernetesRunParameters') as string[];
		if (extraParameters) {
			return extraParameters;
		} else {
			return [];
		}
	}
}
