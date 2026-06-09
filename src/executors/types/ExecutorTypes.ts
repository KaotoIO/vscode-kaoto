/**
 * Core types for the Camel executor system
 */

import { ShellExecution } from 'vscode';

/**
 * Supported executor types
 */
export type ExecutorType = 'jbang' | 'camel-launcher';

/**
 * Supported runtime types
 */
export enum RuntimeType {
	QUARKUS = 'quarkus',
	SPRING_BOOT = 'spring-boot',
	MAIN = 'camel-main',
	CITRUS = 'citrus',
}

/**
 * Camel command types
 */
export type CamelCommand = 'run' | 'export' | 'init' | 'bind' | 'stop' | 'dependency' | 'cmd' | 'plugin' | 'test' | 'kubernetes';

/**
 * Command execution context
 */
export interface CommandContext {
	readonly cwd?: string;
}

/**
 * Command execution result
 */
export interface CommandResult {
	readonly execution: ShellExecution;
	readonly resolvedPort?: number;
}

/**
 * Generic command arguments
 */
export type CommandArguments = string[];
