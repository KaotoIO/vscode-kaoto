/**
 * Base executor implementation
 */

import { ICamelExecutor } from './ICamelExecutor';
import { CamelCommandBuilder } from './builders/CamelCommandBuilder';
import { ExecutorConfig } from './types/ExecutorConfig';
import { CamelCommand, CommandArguments, CommandContext, CommandResult } from './types/ExecutorTypes';

/**
 * Base executor implementation
 * Provides common functionality for all executors
 */
export abstract class BaseExecutor implements ICamelExecutor {
	constructor(
		protected readonly config: ExecutorConfig,
		protected readonly commandBuilder: CamelCommandBuilder,
	) {}

	getConfig(): ExecutorConfig {
		return this.config;
	}

	async execute(command: CamelCommand, args: CommandArguments, context?: CommandContext): Promise<CommandResult> {
		// Validate executor is available
		if (!(await this.isAvailable())) {
			throw new Error(`Executor ${this.config.type} is not available`);
		}

		// Build and execute command using unified builder
		return this.commandBuilder.buildCommand(command, args, context);
	}

	abstract isAvailable(): Promise<boolean>;

	getVersion(): string {
		return this.config.version;
	}
}
