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
 */
export interface CamelLauncherExecutorConfig extends ExecutorConfig {
	readonly type: 'camel-launcher';
	readonly launcherPath?: string;
	readonly autoDownload: boolean;
	readonly storageLocation?: string;
}

/**
 * Union type for all executor configurations
 * Note: Extensible for future executor types (e.g., Kaoto Companion)
 */
export type AnyExecutorConfig = JBangExecutorConfig | CamelLauncherExecutorConfig;
