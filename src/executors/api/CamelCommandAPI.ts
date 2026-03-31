import { CamelExecutorFactory } from '../CamelExecutorFactory';
import { CommandArguments, CommandContext, CommandResult } from '../types/ExecutorTypes';

/**
 * High-level API for executing Camel commands
 * Used by task classes to abstract executor details
 */
export class CamelCommandAPI {
	/**
	 * Run a Camel integration
	 */
	static async run(filePath: string, cwd: string, port?: number, additionalArgs: CommandArguments = []): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();

		const args: CommandArguments = this.filterEmptyArgs([`'${filePath}'`, port ? `--management-port=${port}` : '', ...additionalArgs]);

		return await executor.execute('run', args, { cwd });
	}

	/**
	 * Export a Camel integration to Maven project
	 */
	static async export(
		filePath: string,
		gav: string,
		runtime: string,
		outputPath: string,
		cwd: string,
		additionalArgs: CommandArguments = [],
	): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();

		const args: CommandArguments = this.filterEmptyArgs([
			`'${filePath}'`,
			`--runtime=${runtime}`,
			`--gav=${gav}`,
			`--directory=${outputPath}`,
			...additionalArgs,
		]);

		return await executor.execute('export', args, { cwd });
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
	static async bind(source: string, sink: string, cwd?: string, additionalArgs: CommandArguments = []): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		const args: CommandArguments = this.filterEmptyArgs([source, sink, ...additionalArgs]);
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
	static async plugin(action: string, pluginName: string, cwd?: string, additionalArgs: CommandArguments = []): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		const args: CommandArguments = this.filterEmptyArgs([action, pluginName, ...additionalArgs]);
		return await executor.execute('plugin', args, { cwd });
	}

	/**
	 * Run Camel tests
	 */
	static async test(filePath: string, cwd?: string, additionalArgs: CommandArguments = []): Promise<CommandResult> {
		const executor = await CamelExecutorFactory.createExecutor();
		const args: CommandArguments = this.filterEmptyArgs([`'${filePath}'`, ...additionalArgs]);
		return await executor.execute('test', args, { cwd });
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
