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
import { RelativePattern, ShellExecution, ShellExecutionOptions, Uri, workspace, window } from 'vscode';
import {
	arePathsEqual,
	findFolderOfPomXml,
	KAOTO_CAMEL_JBANG_KUBERNETES_RUN_ARGUMENTS_SETTING_ID,
	KAOTO_CAMEL_JBANG_RED_HAT_MAVEN_REPOSITORY_GLOBAL_SETTING_ID,
	KAOTO_CAMEL_JBANG_RED_HAT_MAVEN_REPOSITORY_SETTING_ID,
	KAOTO_CAMEL_JBANG_RUN_ARGUMENTS_SETTING_ID,
	KAOTO_CAMEL_JBANG_RUN_SOURCE_DIR_ARGUMENTS_SETTING_ID,
	KAOTO_CAMEL_JBANG_VERSION_SETTING_ID,
	KAOTO_LOCAL_KAMELET_DIRECTORIES_SETTING_ID,
	KAOTO_MAVEN_CAMEL_JBANG_EXPORT_FOLDER_ARGUMENTS_SETTING_ID,
	resolvePaths,
} from './helpers';
import { dirname, relative } from 'path';
import { execSync, execFile } from 'child_process';
import { KaotoOutputChannel } from '../extension/KaotoOutputChannel';
import { satisfies } from 'compare-versions';
import { RuntimeMavenInformation } from '@kaoto/kaoto';

export enum RouteOperation {
	start = 'start',
	stop = 'stop',
	suspend = 'suspend',
	resume = 'resume',
}

const isWindows: boolean = process.platform.startsWith('win');

/**
 * Camel JBang class which allows shell execution of different JBang CLI commands
 */
export class CamelJBang {
	private readonly camelJBangVersion: string;
	private readonly defaultJbangArgs: string[];

	constructor(private readonly jbang: string = 'jbang') {
		this.camelJBangVersion = workspace.getConfiguration().get(KAOTO_CAMEL_JBANG_VERSION_SETTING_ID) as string;
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

	public async export(uri: Uri, gav: string, runtime: string, outputPath: string, cwd: string): Promise<ShellExecution> {
		// workaround for an issue during Camel JBang execution in Windows machines.
		// specifying the --directory option with the complete path when it is equal to the current working directory causes issues.
		// omitting the option (using default '.') works as expected.
		const directoryArg = arePathsEqual(dirname(uri.fsPath), outputPath) ? '' : `'--directory=${outputPath}'`;
		const exportArgs = await this.getExportProjectArguments(cwd);
		const parentWorkspaceFolder = workspace.getWorkspaceFolder(uri)?.uri.fsPath ?? '';

		const relativeWorkspacePath = uri.fsPath === parentWorkspaceFolder ? '.' : relative(parentWorkspaceFolder, uri.fsPath);

		if (this.camelJBangVersion.startsWith('4.12') && isWindows) {
			window.showInformationMessage(
				'The created project do not have the Maven wrapper because Camel JBang 4.12 is used on Windows. If you want the Maven wrapper either: call `mvn wrapper:wrapper` on the created project, recreate the project using a different Camel Version or using a non-Windows OS.',
			);
			return new ShellExecution(
				this.jbang,
				[
					...this.defaultJbangArgs,
					'export',
					`'${relativeWorkspacePath}'`,
					`--runtime=${runtime}`,
					`--gav=${gav}`,
					'--maven-wrapper=false',
					directoryArg,
					...exportArgs,
					this.getCamelVersion(),
					this.getRedHatMavenRepository(),
				].filter(function (arg) {
					return arg !== undefined && arg !== null && arg !== ''; // remove ALL empty values ("", null, undefined and 0)
				}),
			);
		} else {
			return new ShellExecution(
				this.jbang,
				[
					...this.defaultJbangArgs,
					'export',
					`'${relativeWorkspacePath}'`,
					`--runtime=${runtime}`,
					`--gav=${gav}`,
					directoryArg,
					...exportArgs,
					this.getCamelVersion(),
					this.getRedHatMavenRepository(),
				].filter(function (arg) {
					return arg !== undefined && arg !== null && arg !== ''; // remove ALL empty values ("", null, undefined and 0)
				}),
			);
		}
	}

	/**
	 * Execute dependency update directly (bypassing VS Code Tasks) to avoid native task failure notifications.
	 * Resolves with the exit code (0 on success, non-zero on failure).
	 */
	public async dependencyUpdate(pomPath: string, routePath: string, cwd?: string): Promise<number> {
		return await new Promise<number>((resolve) => {
			const args: string[] = [
				`-Dcamel.jbang.version=${this.camelJBangVersion}`,
				'camel@apache/camel',
				'dependency',
				'update',
				pomPath,
				routePath,
				'--lazy-bean',
				'--ignore-loading-error',
			];
			KaotoOutputChannel.logInfo(`Camel Dependency Update: jbang ${args.join(' ')}`);
			execFile(this.jbang, args, { cwd, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
				if (stdout) {
					KaotoOutputChannel.logInfo(stdout.toString().trimEnd());
				}
				if (stderr) {
					KaotoOutputChannel.logError(stderr.toString());
				}
				if (error) {
					const anyErr = error as unknown as { code?: number | string | null };
					const code = anyErr?.code;
					resolve(typeof code === 'number' ? code : 1);
				} else {
					resolve(0);
				}
			});
		});
	}

	public async run(filePath: string, cwd: string, port?: number): Promise<ShellExecution> {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: cwd,
		};
		const runArgs = await this.getRunArguments(filePath, cwd);
		const portArg = this.getPortArgument(port);
		return new ShellExecution(
			this.jbang,
			[
				...this.defaultJbangArgs,
				'run',
				`'${filePath}'`,
				'--console',
				portArg,
				...runArgs,
				this.getCamelVersion(),
				this.getRedHatMavenRepository(),
			].filter(function (arg) {
				return arg !== undefined && arg !== null && arg !== ''; // remove ALL empty values ("", null, undefined and 0)
			}),
			shellExecOptions,
		);
	}

	public async runSourceDir(sourceDir: string, port?: number): Promise<ShellExecution> {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: sourceDir,
		};
		const runArgs = await this.getRunSourceDirArguments(sourceDir);
		const portArg = this.getPortArgument(port);
		return new ShellExecution(
			this.jbang,
			[
				...this.defaultJbangArgs,
				'run',
				`'--source-dir=${sourceDir}'`,
				'--console',
				portArg,
				...runArgs,
				this.getCamelVersion(),
				this.getRedHatMavenRepository(),
			].filter(function (arg) {
				return arg !== undefined && arg !== null && arg !== ''; // remove ALL empty values ("", null, undefined and 0)
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
				return arg !== undefined && arg !== null && arg !== ''; // remove ALL empty values ("", null, undefined and 0)
			}), // remove ALL empty values ("", null, undefined and 0)
			shellExecOptions,
		);
	}

	public stop(name: string): ShellExecution {
		return new ShellExecution(this.jbang, [...this.defaultJbangArgs, 'stop', name]);
	}

	public route(operation: RouteOperation, integration: string, routeId: string): ShellExecution {
		return new ShellExecution(this.jbang, [...this.defaultJbangArgs, 'cmd', `${operation}-route`, integration, `--id=${routeId}`]);
	}

	public async getRuntimeInfoFromMavenContext(integrationFilePath: string): Promise<RuntimeMavenInformation | undefined> {
		const folderOfPomXml = findFolderOfPomXml(integrationFilePath);
		if (folderOfPomXml === undefined) {
			return undefined;
		} else {
			try {
				let camelJbangVersionToUse: string;
				// This ensures versions lower than 4.13 fall back; 4.13 or newer use the configured version.
				if (satisfies(this.camelJBangVersion, '>=4.13')) {
					camelJbangVersionToUse = this.camelJBangVersion;
				} else {
					const defaultValue = workspace.getConfiguration().inspect(KAOTO_CAMEL_JBANG_VERSION_SETTING_ID)?.defaultValue as string;
					camelJbangVersionToUse = defaultValue ?? '4.13.0';
				}
				const response: string = execSync(
					`jbang '-Dcamel.jbang.version=${camelJbangVersionToUse}' camel@apache/camel dependency runtime --json pom.xml`,
					{
						stdio: 'pipe',
						cwd: folderOfPomXml,
					},
				).toString();
				return JSON.parse(response) as RuntimeMavenInformation;
			} catch (ex) {
				KaotoOutputChannel.logError('Error while trying to retrieve the runtime information from Maven context', ex);
				return undefined;
			}
		}
	}

	/**
	 * Get the port argument for the JBang command.
	 *
	 * Camel JBang 4.14+ uses the management port instead of the regular port.
	 * From Camel docs:
	 * --management-port=<managementPort> To use a dedicated port for HTTP management. Default: -1
	 * @param port - The port to use.
	 * @returns The port argument.
	 */
	private getPortArgument(port?: number): string {
		return satisfies(this.camelJBangVersion, '>=4.14') ? `--management-port=${port ?? -1}` : `--port=${port ?? 8080}`;
	}

	private async getExportProjectArguments(cwd: string): Promise<string[]> {
		const exportArgs = workspace.getConfiguration().get(KAOTO_MAVEN_CAMEL_JBANG_EXPORT_FOLDER_ARGUMENTS_SETTING_ID) as string[];
		return await this.handleLocalKameletDirArgument(exportArgs, cwd);
	}

	private getKubernetesRunArguments(): string[] {
		const kubernetesRunArgs = workspace.getConfiguration().get(KAOTO_CAMEL_JBANG_KUBERNETES_RUN_ARGUMENTS_SETTING_ID) as string[];
		if (kubernetesRunArgs.length > 0) {
			return kubernetesRunArgs;
		} else {
			return [];
		}
	}

	private async getRunArguments(filePath: string, cwd: string): Promise<string[]> {
		const runArgs = workspace.getConfiguration().get(KAOTO_CAMEL_JBANG_RUN_ARGUMENTS_SETTING_ID) as string[];
		return await this.handleLocalKameletDirArgument(await this.handleMissingXslFiles(filePath, runArgs), cwd);
	}

	private async getRunSourceDirArguments(cwd: string): Promise<string[]> {
		const runArgs = workspace.getConfiguration().get(KAOTO_CAMEL_JBANG_RUN_SOURCE_DIR_ARGUMENTS_SETTING_ID) as string[];
		return await this.handleLocalKameletDirArgument(runArgs, cwd);
	}

	private async handleLocalKameletDirArgument(runArgs: string[], cwd: string): Promise<string[]> {
		const localKameletDirIndex = runArgs.findIndex((parameter) => parameter.startsWith('--local-kamelet-dir'));

		// Early return if local kamelet directory argument is already present
		if (localKameletDirIndex !== -1) {
			runArgs[localKameletDirIndex] = await this.resolveAlreadyExistingLocalKameletDirArgument(runArgs[localKameletDirIndex], cwd);
			return runArgs;
		}

		const localKameletDirectoriesGlobalArgument = await this.resolveLocalKameletDirsFromGlobalSetting(cwd);

		// Early return if no GLOBAL kaoto.localKameletDirectories setting is configured
		if (!localKameletDirectoriesGlobalArgument) {
			return runArgs;
		}

		// Append the GLOBAL local kamelet directory argument if it is configured to the run arguments (list of directories)
		return [...runArgs, localKameletDirectoriesGlobalArgument];
	}

	private async resolveAlreadyExistingLocalKameletDirArgument(existingKameletDirArgument: string, cwd: string): Promise<string> {
		const kameletDirPaths = existingKameletDirArgument
			.replace('--local-kamelet-dir=', '') // remove the --local-kamelet-dir= prefix
			.split(',')
			.map((path) => path.trim());
		const resolvedKameletDirPaths = resolvePaths(kameletDirPaths, cwd);
		return `'--local-kamelet-dir=${Array.from(resolvedKameletDirPaths).join(',')}'`;
	}

	private async resolveLocalKameletDirsFromGlobalSetting(cwd: string): Promise<string | undefined> {
		const localKameletDirectories = workspace.getConfiguration().get(KAOTO_LOCAL_KAMELET_DIRECTORIES_SETTING_ID) as string[];
		if (localKameletDirectories.length > 0) {
			return `'--local-kamelet-dir=${Array.from(resolvePaths(localKameletDirectories, cwd)).join(',')}'`;
		} else {
			return undefined;
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
			const url = workspace.getConfiguration().get(KAOTO_CAMEL_JBANG_RED_HAT_MAVEN_REPOSITORY_SETTING_ID) as string;
			const reposPlaceholder = this.getCamelGlobalRepos();
			return url ? `--repos=${reposPlaceholder}${url}` : '';
		} else {
			return '';
		}
	}

	private getCamelGlobalRepos(): string {
		const globalRepos = workspace.getConfiguration().get(KAOTO_CAMEL_JBANG_RED_HAT_MAVEN_REPOSITORY_GLOBAL_SETTING_ID) as boolean;
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
