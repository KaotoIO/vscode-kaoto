/**
 * Camel Launcher executor implementation
 */

import { existsSync } from 'fs';
import { BaseExecutor } from './BaseExecutor';
import { CamelCommandBuilder } from './builders/CamelCommandBuilder';
import { CamelLauncherExecutorConfig } from './types/ExecutorConfig';

/**
 * Camel Launcher executor implementation
 */
export class CamelLauncherExecutor extends BaseExecutor {
	constructor(config: CamelLauncherExecutorConfig, launcherPath: string) {
		// Configure builder for Camel Launcher (no prefix args needed)
		const commandBuilder = new CamelCommandBuilder({
			executable: launcherPath,
			prefixArgs: [], // Camel Launcher doesn't need prefix arguments
		});

		super(config, commandBuilder);
	}

	async isAvailable(): Promise<boolean> {
		const config = this.config as CamelLauncherExecutorConfig;
		return config.launcherPath ? existsSync(config.launcherPath) : false;
	}
}
