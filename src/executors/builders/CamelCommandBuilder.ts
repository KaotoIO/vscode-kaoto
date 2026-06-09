/**
 * Unified command builder for all Camel executors
 */

import { ShellExecution } from 'vscode';
import { CamelCommand, CommandArguments, CommandContext, CommandResult } from '../types/ExecutorTypes';

/**
 * Configuration for command builder
 */
export interface CommandBuilderConfig {
	/** Executable path (e.g., 'jbang' or '/path/to/camel-launcher/bin/camel') */
	executable: string;

	/** Prefix arguments to add before the Camel command (e.g., JBang needs ['-Dcamel.jbang.version=X', 'camel@apache/camel']) */
	prefixArgs?: string[];
}

/**
 * Unified command builder for all Camel executors
 * Handles both JBang and Camel Launcher with configuration
 */
export class CamelCommandBuilder {
	constructor(private readonly config: CommandBuilderConfig) {}

	/**
	 * Build command for execution
	 * Structure: <executable> [...prefixArgs] <command> <args>
	 */
	buildCommand(command: CamelCommand, args: CommandArguments, context?: CommandContext): CommandResult {
		// Build command parts: [prefixArgs, command, args]
		const commandParts = CamelCommandBuilder.filterEmptyArgs([...(this.config.prefixArgs || []), command, ...args]);

		const execution = this.buildExecution(this.config.executable, commandParts, context);
		const resolvedPort = this.extractPort(args);

		return this.buildResult(execution, resolvedPort);
	}

	/**
	 * Build shell execution from command components
	 */
	private buildExecution(executable: string, commandParts: string[], context?: CommandContext): ShellExecution {
		return new ShellExecution(executable, commandParts, { cwd: context?.cwd });
	}

	/**
	 * Filter empty/null/undefined arguments from a command args array
	 */
	static filterEmptyArgs(args: (string | undefined | null)[]): string[] {
		return args.filter((arg) => arg !== undefined && arg !== null && arg !== '') as string[];
	}

	/**
	 * Build command result
	 */
	private buildResult(execution: ShellExecution, resolvedPort?: number): CommandResult {
		return {
			execution,
			resolvedPort,
		};
	}

	/**
	 * Extract port from arguments
	 */
	private extractPort(args: CommandArguments): number | undefined {
		const portArg = args.find((arg) => arg.startsWith('--port=') || arg.startsWith('--management-port='));
		if (portArg) {
			const match = portArg.match(/=(-?\d+)/);
			return match ? parseInt(match[1], 10) : undefined;
		}
		return undefined;
	}
}
