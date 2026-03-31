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
import { RelativePattern, ShellExecution, ShellExecutionOptions, ShellQuotedString, ShellQuoting, Uri, workspace, window } from 'vscode';
import {
	arePathsEqual,
	findFolderOfPomXml,
	KAOTO_CAMEL_JBANG_RED_HAT_MAVEN_REPOSITORY_GLOBAL_SETTING_ID,
	KAOTO_CAMEL_JBANG_RED_HAT_MAVEN_REPOSITORY_SETTING_ID,
	KAOTO_CAMEL_JBANG_RUN_ARGUMENTS_SETTING_ID,
	KAOTO_CAMEL_JBANG_RUN_SOURCE_DIR_ARGUMENTS_SETTING_ID,
	KAOTO_CAMEL_JBANG_VERSION_SETTING_ID,
	KAOTO_LOCAL_KAMELET_DIRECTORIES_SETTING_ID,
	KAOTO_MAVEN_CAMEL_JBANG_EXPORT_FOLDER_ARGUMENTS_SETTING_ID,
	resolvePaths,
} from './helpers';
import path, { dirname, relative } from 'path';
import { execSync } from 'child_process';
import { KaotoOutputChannel } from '../extension/KaotoOutputChannel';
import { satisfies } from 'compare-versions';
import { RuntimeMavenInformation } from '@kaoto/kaoto';
import { ArgumentConflict, ArgumentConflictDetector } from './ArgumentConflictDetector';

export enum RouteOperation {
	start = 'start',
	stop = 'stop',
	suspend = 'suspend',
	resume = 'resume',
}

export const isWindows: boolean = process.platform.startsWith('win');

/**
 * Camel JBang class which allows shell execution of different JBang CLI commands
 */
export class CamelJBang {
	protected readonly camelJBangVersion: string;
	protected readonly defaultJbangArgs: string[];

	constructor(protected readonly jbang: string = 'jbang') {
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

	public async export(uri: Uri, gav: string, runtime: string, outputPath: string, cwd: string, kubernetes?: boolean): Promise<ShellExecution> {
		// workaround for an issue during Camel JBang execution in Windows machines.
		// specifying the --directory option with the complete path when it is equal to the current working directory causes issues.
		// omitting the option (using default '.') works as expected.
		const directoryArg = arePathsEqual(dirname(uri.fsPath), outputPath) ? '' : `'--directory=${outputPath}'`;
		const { args: exportArgs, conflicts: exportConflicts } = await this.getExportProjectArguments(cwd);
		const parentWorkspaceFolder = workspace.getWorkspaceFolder(uri)?.uri.fsPath ?? '';

		const relativeWorkspacePath = uri.fsPath === parentWorkspaceFolder ? '.' : relative(parentWorkspaceFolder, uri.fsPath);

		const quarkusOpenshiftDependency = runtime === 'quarkus' && kubernetes ? ['--dependency=mvn:io.quarkus:quarkus-openshift'] : [];

		// Get camel version and repos arguments with conflict detection
		const camelVersionArg = this.getCamelVersion(exportArgs);
		const reposArg = this.getRedHatMavenRepository(exportArgs);

		// Collect all conflicts
		const allConflicts = [...exportConflicts];

		// Show warnings for all conflicts
		await this.showConflictWarnings(allConflicts);

		if (this.camelJBangVersion.startsWith('4.12') && isWindows) {
			window.showInformationMessage(
				'The created project do not have the Maven wrapper because Camel JBang 4.12 is used on Windows. If you want the Maven wrapper either: call `mvn wrapper:wrapper` on the created project, recreate the project using a different Camel Version or using a non-Windows OS.',
			);
			return new ShellExecution(
				this.jbang,
				this.filterEmptyArgs([
					...this.defaultJbangArgs,
					kubernetes ? 'kubernetes' : '',
					'export',
					`'${relativeWorkspacePath}'`,
					`--runtime=${runtime}`,
					`--gav=${gav}`,
					'--maven-wrapper=false',
					directoryArg,
					...quarkusOpenshiftDependency,
					...exportArgs,
					camelVersionArg,
					reposArg,
				]),
			);
		} else {
			return new ShellExecution(
				this.jbang,
				this.filterEmptyArgs([
					...this.defaultJbangArgs,
					kubernetes ? 'kubernetes' : '',
					'export',
					`'${relativeWorkspacePath}'`,
					`--runtime=${runtime}`,
					`--gav=${gav}`,
					directoryArg,
					...quarkusOpenshiftDependency,
					...exportArgs,
					camelVersionArg,
					reposArg,
				]),
			);
		}
	}

	/**
	 * Execute the 'jbang camel@apache/camel dependency update' command to update the Camel dependencies in the pom.xml file.
	 * @param pomPath - The path to the pom.xml file.
	 * @param integrationFilePath - The path to the integration file.
	 * @returns The shell execution for the dependency update command.
	 */
	public dependencyUpdate(pomPath: string, integrationFilePath: string): ShellExecution {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: path.dirname(pomPath),
		};
		const quotedPomPath: ShellQuotedString = { value: pomPath, quoting: ShellQuoting.Strong };
		const quotedIntegrationFilePath: ShellQuotedString = { value: integrationFilePath, quoting: ShellQuoting.Strong };
		return new ShellExecution(
			this.jbang,
			[...this.defaultJbangArgs, 'dependency', 'update', quotedPomPath, quotedIntegrationFilePath, '--lazy-bean', '--ignore-loading-error'],
			shellExecOptions,
		);
	}

	public async run(filePath: string, cwd: string, port?: number): Promise<{ execution: ShellExecution; resolvedPort: number }> {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: cwd,
		};
		const { args: runArgs, conflicts: runConflicts } = await this.getRunArguments(filePath, cwd);
		const { argument: portArg, resolvedPort } = this.getPortArgument(port, runArgs);
		const camelVersionArg = this.getCamelVersion(runArgs);
		const reposArg = this.getRedHatMavenRepository(runArgs);

		// Show warnings for all conflicts
		await this.showConflictWarnings(runConflicts);

		const execution = new ShellExecution(
			this.jbang,
			this.filterEmptyArgs([...this.defaultJbangArgs, 'run', `'${filePath}'`, portArg, ...runArgs, camelVersionArg, reposArg]),
			shellExecOptions,
		);

		return { execution, resolvedPort };
	}

	public async runSourceDir(sourceDir: string, port?: number): Promise<{ execution: ShellExecution; resolvedPort: number }> {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: sourceDir,
		};
		const { args: runArgs, conflicts: runConflicts } = await this.getRunSourceDirArguments(sourceDir);
		const { argument: portArg, resolvedPort } = this.getPortArgument(port, runArgs);
		const camelVersionArg = this.getCamelVersion(runArgs);
		const reposArg = this.getRedHatMavenRepository(runArgs);

		// Show warnings for all conflicts
		await this.showConflictWarnings(runConflicts);

		const execution = new ShellExecution(
			this.jbang,
			this.filterEmptyArgs([...this.defaultJbangArgs, 'run', `'--source-dir=${sourceDir}'`, portArg, ...runArgs, camelVersionArg, reposArg]),
			shellExecOptions,
		);

		return { execution, resolvedPort };
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
	 * Filter out empty arguments (undefined, null, and empty strings).
	 * @param args - Array of arguments that may contain empty values.
	 * @returns Filtered array with only non-empty string values.
	 */
	private filterEmptyArgs(args: (string | undefined | null)[]): string[] {
		return args.filter((arg) => arg !== undefined && arg !== null && arg !== '') as string[];
	}

	/**
	 * Get the port argument for the JBang command and resolve the actual port number.
	 *
	 * Camel JBang 4.14+ uses the management port instead of the regular port.
	 * From Camel docs:
	 * --management-port=<managementPort> To use a dedicated port for HTTP management. Default: -1
	 * @param port - The port to use (code default).
	 * @param userArgs - User-defined arguments to check for conflicts.
	 * @returns Object containing the port argument string and the resolved port number.
	 */
	protected getPortArgument(port?: number, userArgs: string[] = []): { argument: string; resolvedPort: number } {
		// Check if user has defined --management-port or --port
		const userDefinedPort = ArgumentConflictDetector.extractPortValue(userArgs);

		if (userDefinedPort !== undefined) {
			// User setting takes priority, don't add code default
			return { argument: '', resolvedPort: userDefinedPort };
		}

		// Use code defaults - always use the allocated port, never -1
		// If no port is provided, we can't monitor the integration
		const useManagementPort = satisfies(this.camelJBangVersion, '>=4.14');
		const effectivePort = port ?? 8080; // Fallback to 8080 if no port allocated
		const argument = useManagementPort ? `--management-port=${effectivePort}` : `--port=${effectivePort}`;

		return { argument, resolvedPort: effectivePort };
	}

	/**
	 * Show warnings for detected argument conflicts
	 * Logs conflicts to the Kaoto output channel and displays a VS Code notification
	 * @param conflicts - Array of detected conflicts between code defaults and user settings
	 */
	protected async showConflictWarnings(conflicts: ArgumentConflict[]): Promise<void> {
		if (conflicts.length === 0) {
			return;
		}

		const message =
			`Camel JBang argument conflicts detected (user settings override code defaults):\n` +
			conflicts.map((c) => `  - ${c.argument}: code="${c.codeValue}" overridden by user="${c.userValue}"`).join('\n');

		KaotoOutputChannel.logWarning(message);

		// Show a single notification for all conflicts
		const selection = await window.showInformationMessage(
			`Camel JBang: ${conflicts.length} argument(s) overridden by user settings. Check output for details.`,
			'View Output',
		);
		if (selection === 'View Output') {
			KaotoOutputChannel.getInstance().show();
		}
	}

	protected async getExportProjectArguments(cwd: string): Promise<{ args: string[]; conflicts: ArgumentConflict[] }> {
		const exportArgs = workspace.getConfiguration().get(KAOTO_MAVEN_CAMEL_JBANG_EXPORT_FOLDER_ARGUMENTS_SETTING_ID) as string[];
		const processedArgs = await this.handleLocalKameletDirArgument(exportArgs, cwd);
		// No hardcoded arguments to merge for export, but return consistent structure
		return { args: processedArgs, conflicts: [] };
	}

	protected async getRunArguments(filePath: string, cwd: string): Promise<{ args: string[]; conflicts: ArgumentConflict[] }> {
		const runArgs = workspace.getConfiguration().get(KAOTO_CAMEL_JBANG_RUN_ARGUMENTS_SETTING_ID) as string[];
		const processedArgs = await this.handleLocalKameletDirArgument(await this.handleMissingXslFiles(filePath, runArgs), cwd);

		// Merge with hardcoded --console argument
		const codeArgs = ['--console'];
		const result = ArgumentConflictDetector.mergeArguments(codeArgs, processedArgs, 'run');

		return { args: result.merged, conflicts: result.conflicts };
	}

	protected async getRunSourceDirArguments(cwd: string): Promise<{ args: string[]; conflicts: ArgumentConflict[] }> {
		const runArgs = workspace.getConfiguration().get(KAOTO_CAMEL_JBANG_RUN_SOURCE_DIR_ARGUMENTS_SETTING_ID) as string[];
		const processedArgs = await this.handleLocalKameletDirArgument(runArgs, cwd);

		// Merge with hardcoded --console argument
		const codeArgs = ['--console'];
		const result = ArgumentConflictDetector.mergeArguments(codeArgs, processedArgs, 'runSourceDir');

		return { args: result.merged, conflicts: result.conflicts };
	}

	protected async handleLocalKameletDirArgument(runArgs: string[], cwd: string): Promise<string[]> {
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

	protected async resolveAlreadyExistingLocalKameletDirArgument(existingKameletDirArgument: string, cwd: string): Promise<string> {
		const kameletDirPaths = existingKameletDirArgument
			.replace('--local-kamelet-dir=', '') // remove the --local-kamelet-dir= prefix
			.split(',')
			.map((path) => path.trim());
		const resolvedKameletDirPaths = resolvePaths(kameletDirPaths, cwd);
		return `'--local-kamelet-dir=${Array.from(resolvedKameletDirPaths).join(',')}'`;
	}

	protected async resolveLocalKameletDirsFromGlobalSetting(cwd: string): Promise<string | undefined> {
		const localKameletDirectories = workspace.getConfiguration().get(KAOTO_LOCAL_KAMELET_DIRECTORIES_SETTING_ID) as string[];
		if (localKameletDirectories.length > 0) {
			return `'--local-kamelet-dir=${Array.from(resolvePaths(localKameletDirectories, cwd)).join(',')}'`;
		} else {
			return undefined;
		}
	}

	protected getCamelVersion(userArgs: string[] = []): string {
		// Check if user has defined --camel-version
		if (ArgumentConflictDetector.hasArgument(userArgs, 'camel-version')) {
			// User setting takes priority, don't add code default
			return '';
		}

		const camelVersion = workspace.getConfiguration().get('kaoto.camelVersion');
		if (camelVersion) {
			return `--camel-version=${camelVersion as string}`;
		} else {
			return '';
		}
	}

	protected getRedHatMavenRepository(userArgs: string[] = []): string {
		// Check if user has defined --repos
		if (ArgumentConflictDetector.hasArgument(userArgs, 'repos')) {
			// User setting takes priority, don't add code default
			return '';
		}

		if (this.getCamelVersion(userArgs).includes('redhat')) {
			const url = workspace.getConfiguration().get(KAOTO_CAMEL_JBANG_RED_HAT_MAVEN_REPOSITORY_SETTING_ID) as string;
			const reposPlaceholder = this.getCamelGlobalRepos();
			return url ? `--repos=${reposPlaceholder}${url}` : '';
		} else {
			return '';
		}
	}

	protected getCamelGlobalRepos(): string {
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
