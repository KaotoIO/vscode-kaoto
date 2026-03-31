/**
 * Core types for the Camel executor system
 */

import { ShellExecution } from 'vscode';

/**
 * Supported executor types
 */
export type ExecutorType = 'jbang' | 'camel-launcher';

/**
 * Camel command types
 */
export type CamelCommand = 'run' | 'export' | 'init' | 'bind' | 'stop' | 'dependency' | 'cmd' | 'plugin' | 'test' | 'kubernetes';

/**
 * Command execution context
 */
export interface CommandContext {
	readonly cwd?: string;
	readonly env?: Record<string, string>;
}

/**
 * Command execution result
 */
export interface CommandResult {
	readonly execution: ShellExecution;
	readonly resolvedPort?: number;
	readonly metadata?: Record<string, unknown>;
}

/**
 * Generic command arguments
 */
export type CommandArguments = string[];
