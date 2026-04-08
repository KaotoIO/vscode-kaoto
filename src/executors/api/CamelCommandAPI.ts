import { CamelExecutorFactory } from '../CamelExecutorFactory';
import { CommandArguments, CommandResult } from '../types/ExecutorTypes';
import { CamelSettingsHelper } from '../helpers/CamelSettingsHelper';

/**
 * High-level API for executing Camel commands
 * Used by task classes to abstract executor details
 * Integrates user settings from VS Code configuration
 */
export class CamelCommandAPI {
	/**
	 * Run a Camel integration with user settings
	 */
	static async run(filePath: string, cwd: string, port?: number, additionalArgs: CommandArguments = []): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		const settingsHelper = new CamelSettingsHelper();

		// Get user settings
		const { args: userArgs, conflicts } = await settingsHelper.getRunArguments(filePath, cwd);
		const { argument: portArg, resolvedPort } = settingsHelper.getPortArgument(port, userArgs);
		const runtimeArg = settingsHelper.getRuntimeArgument(userArgs);
		const camelVersionArg = await settingsHelper.getCamelVersionArgument(userArgs);
		const reposArg = await settingsHelper.getRedHatMavenRepositoryArgument(userArgs);

		// Show conflict warnings
		await settingsHelper.showConflictWarnings(conflicts);

		// Build final arguments
		const args: CommandArguments = this.filterEmptyArgs([`'${filePath}'`, portArg, runtimeArg, ...userArgs, ...additionalArgs, camelVersionArg, reposArg]);

		const result = await executor.execute('run', args, { cwd });
		// Override resolved port if we determined it from settings
		if (portArg) {
			return {
				...result,
				resolvedPort: resolvedPort,
			};
		}
		return result;
	}

	/**
	 * Run a Camel integration from source directory with user settings
	 */
	static async runSourceDir(sourceDir: string, port?: number, additionalArgs: CommandArguments = []): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		const settingsHelper = new CamelSettingsHelper();

		// Get user settings
		const { args: userArgs, conflicts } = await settingsHelper.getRunSourceDirArguments(sourceDir);
		const { argument: portArg, resolvedPort } = settingsHelper.getPortArgument(port, userArgs);
		const runtimeArg = settingsHelper.getRuntimeArgument(userArgs);
		const camelVersionArg = await settingsHelper.getCamelVersionArgument(userArgs);
		const reposArg = await settingsHelper.getRedHatMavenRepositoryArgument(userArgs);

		// Show conflict warnings
		await settingsHelper.showConflictWarnings(conflicts);

		// Build final arguments
		const args: CommandArguments = this.filterEmptyArgs([
			`'--source-dir=${sourceDir}'`,
			portArg,
			runtimeArg,
			...userArgs,
			...additionalArgs,
			camelVersionArg,
			reposArg,
		]);

		const result = await executor.execute('run', args, { cwd: sourceDir });
		if (portArg) {
			return {
				...result,
				resolvedPort: resolvedPort,
			};
		}
		return result;
	}

	/**
	 * Export a Camel integration to Maven project with user settings
	 */
	static async export(
		filePath: string,
		gav: string,
		runtime: string,
		outputPath: string,
		cwd: string,
		kubernetes?: boolean,
		additionalArgs: CommandArguments = [],
	): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		const settingsHelper = new CamelSettingsHelper();

		// Get user settings
		const { args: userArgs, conflicts } = await settingsHelper.getExportArguments(cwd);
		const camelVersionArg = await settingsHelper.getCamelVersionArgument(userArgs);
		const reposArg = await settingsHelper.getRedHatMavenRepositoryArgument(userArgs);

		// Show conflict warnings
		await settingsHelper.showConflictWarnings(conflicts);

		// Add quarkus-openshift dependency if kubernetes export with quarkus runtime
		const quarkusOpenshiftDependency = runtime === 'quarkus' && kubernetes ? ['--dependency=mvn:io.quarkus:quarkus-openshift'] : [];

		// Build final arguments
		const args: CommandArguments = this.filterEmptyArgs([
			`'${filePath}'`,
			`--runtime=${runtime}`,
			`--gav=${gav}`,
			`--directory=${outputPath}`,
			...quarkusOpenshiftDependency,
			...userArgs,
			...additionalArgs,
			camelVersionArg,
			reposArg,
		]);

		// Use 'kubernetes export' if kubernetes flag is true, otherwise 'export'
		if (kubernetes) {
			return await executor.execute('kubernetes', ['export', ...args], { cwd });
		} else {
			return await executor.execute('export', args, { cwd });
		}
	}

	/**
	 * Initialize a new Camel file
	 */
	static async init(filePath: string, cwd?: string): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		return await executor.execute('init', [`'${filePath}'`], { cwd });
	}

	/**
	 * Stop a running integration
	 */
	static async stop(name: string, cwd?: string): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		return await executor.execute('stop', [name], { cwd });
	}

	/**
	 * Bind a Kamelet to a source/sink
	 */
	static async bind(file: string, source: string, sink: string, cwd?: string, additionalArgs: CommandArguments = []): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		const args: CommandArguments = this.filterEmptyArgs(['--source', source, '--sink', sink, `'${file}'`, ...additionalArgs]);
		return await executor.execute('bind', args, { cwd });
	}

	/**
	 * Update dependencies
	 */
	static async dependency(action: string, filePath: string, cwd?: string, additionalArgs: CommandArguments = []): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		const args: CommandArguments = this.filterEmptyArgs([action, `'${filePath}'`, ...additionalArgs]);
		return await executor.execute('dependency', args, { cwd });
	}

	/**
	 * Execute a custom Camel command
	 */
	static async cmd(cmdArgs: CommandArguments, cwd?: string): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		return await executor.execute('cmd', cmdArgs, { cwd });
	}

	/**
	 * Add a plugin
	 */
	static async pluginAdd(pluginName: string, cwd?: string, additionalArgs: CommandArguments = []): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		const args: CommandArguments = this.filterEmptyArgs(['add', pluginName, ...additionalArgs]);
		return await executor.execute('plugin', args, { cwd });
	}

	/**
	 * Update dependencies in pom.xml
	 */
	static async dependencyUpdate(pomPath: string, integrationFilePath: string, cwd?: string): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		const args: CommandArguments = ['update', pomPath, integrationFilePath, '--lazy-bean', '--ignore-loading-error'];
		return await executor.execute('dependency', args, { cwd });
	}

	/**
	 * Execute route operations (start, stop, suspend, resume)
	 */
	static async routeOperation(operation: string, integration: string, routeId: string, cwd?: string): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		const args: CommandArguments = [`${operation}-route`, integration, `--id=${routeId}`];
		return await executor.execute('cmd', args, { cwd });
	}

	/**
	 * Initialize a new Camel test file
	 */
	static async testInit(filePath: string, cwd?: string): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		return await executor.execute('test', ['init', `'${filePath}'`], { cwd });
	}

	/**
	 * Run Camel tests
	 */
	static async testRun(filePath: string, cwd?: string, additionalArgs: CommandArguments = []): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		const args: CommandArguments = this.filterEmptyArgs(['run', `'${filePath}'`, ...additionalArgs]);
		return await executor.execute('test', args, { cwd });
	}

	/**
	 * Run all Camel tests in a folder
	 */
	static async testRunFolder(folderPath: string): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		const args: CommandArguments = ['run', '*'];
		return await executor.execute('test', args, { cwd: folderPath });
	}

	/**
	 * Execute Kubernetes run operation
	 */
	static async kubernetesRun(filePattern: string, cwd?: string, additionalArgs: CommandArguments = []): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		const args: CommandArguments = this.filterEmptyArgs(['run', filePattern, ...additionalArgs]);
		return await executor.execute('kubernetes', args, { cwd });
	}

	/**
	 * Execute Kubernetes operations
	 */
	static async kubernetes(action: string, cwd?: string, additionalArgs: CommandArguments = []): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		const args: CommandArguments = this.filterEmptyArgs([action, ...additionalArgs]);
		return await executor.execute('kubernetes', args, { cwd });
	}

	/**
	 * Filter empty arguments
	 */
	private static filterEmptyArgs(args: (string | undefined | null)[]): string[] {
		return args.filter((arg) => arg !== undefined && arg !== null && arg !== '') as string[];
	}
}
