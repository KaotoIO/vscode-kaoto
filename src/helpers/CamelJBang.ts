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

import { globSync } from "glob";
import { ShellExecution, ShellExecutionOptions, workspace, WorkspaceFolder } from "vscode";
import { arePathsEqual, getCurrentWorkingDirectory } from "./helpers";

export enum RouteOperation {
	start = 'start',
	stop = 'stop',
	suspend = 'suspend',
	resume = 'resume'
}

/**
 * Camel JBang class which allows shell execution of different JBang CLI commands
 */
export class CamelJBang {

	private camelJBangVersion: string;

	constructor(private readonly jbang: string = 'jbang') {
		this.camelJBangVersion = workspace.getConfiguration().get('kaoto.camelJBang.Version') as string;
	}

	public init(file: string): ShellExecution {
		return new ShellExecution(this.jbang, [`'-Dcamel.jbang.version=${this.camelJBangVersion}'`, 'camel@apache/camel', 'init', `'${file}'`]);
	}

	public run(filePattern: string, cwd?: string, port?: number): ShellExecution {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: cwd
		};
		return new ShellExecution(this.jbang,
			[`'-Dcamel.jbang.version=${this.camelJBangVersion}'`,
				'camel@apache/camel',
				'run',
				filePattern,
				'--dev',
				'--logging-level=info',
				'--console',
				`--port=${port ? port : 8080}`,
				this.getCamelVersion(),
				this.getRedHatMavenRepository(),
				...this.getExtraLaunchParameter()
			].filter(function (arg) { return arg; }), // remove ALL empty values ("", null, undefined and 0)
			shellExecOptions
		);
	}

	public stop(name: string): ShellExecution {
		return new ShellExecution(this.jbang,
			[`'-Dcamel.jbang.version=${this.camelJBangVersion}'`,
				'camel@apache/camel',
				'stop',
				name // TODO when running using '*' then log JBang option is not working properly
			]
		);
	}

	public route(operation: RouteOperation, integrationName: string, routeId: string): ShellExecution {
		return new ShellExecution(this.jbang,
			[`'-Dcamel.jbang.version=${this.camelJBangVersion}'`,
				'camel@apache/camel',
				'cmd',
				`${operation}-route`,
				integrationName,
				`--id=${routeId}`
			]
		);
	}

	public log(name: string): ShellExecution {
		return new ShellExecution(this.jbang,
			[`'-Dcamel.jbang.version=${this.camelJBangVersion}'`,
				'camel@apache/camel',
				'log',
				name // TODO when running using '*' then log JBang option is not working properly
			]
		);
	}

	public deploy(filePattern: string, cwd?: string): ShellExecution {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: cwd
		};
		return new ShellExecution(this.jbang,
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
		return new ShellExecution(this.jbang, [`'-Dcamel.jbang.version=${this.camelJBangVersion}'`, 'camel@apache/camel', 'bind', '--source', source, '--sink', sink, `'${file}'`]);
	}

	public createProject(gav: string, runtime: string, outputPath: string): ShellExecution {

		// Workaround for an issue during camel jbang execution in windows machines.
		// Specifying the --directory option with the complete path when it is equal to the current working directory causes issues.
		// Omitting the option or in this case using '.' works as expected.
		let cwd = getCurrentWorkingDirectory();
		if (cwd && arePathsEqual(cwd, outputPath)) {
			outputPath = '.';
		} else{
			// In case there is no folder open we use the outputPath as the current working directory to avoid using the users home folder.
			cwd = outputPath;
		}

		return new ShellExecution('jbang',
			[`'-Dcamel.jbang.version=${this.camelJBangVersion}'`,
				'camel@apache/camel',
				'export',
				`--runtime=${runtime}`,
				`--gav=${gav}`,
				`'--directory=${outputPath}'`], { cwd });
	}

	public add(plugin: string): ShellExecution {
		return new ShellExecution(this.jbang,
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
