/**
 * Executor configuration types
 */

import { ExecutorType } from './ExecutorTypes';

/**
 * Base executor configuration
 */
export interface ExecutorConfig {
	readonly type: ExecutorType;
	readonly version: string;
}

/**
 * JBang executor configuration
 */
export interface JBangExecutorConfig extends ExecutorConfig {
	readonly type: 'jbang';
	readonly jbangPath?: string;
}

/**
 * Camel Launcher executor configuration
 * For first iteration: always auto-downloads based on version
 */
export interface CamelLauncherExecutorConfig extends ExecutorConfig {
	readonly type: 'camel-launcher';
	readonly autoDownload: boolean; // Always true for first iteration
}

/**
 * Union type for all executor configurations
 * Note: Extensible for future executor types (e.g., Kaoto Companion)
 */
export type AnyExecutorConfig = JBangExecutorConfig | CamelLauncherExecutorConfig;
