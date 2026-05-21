/**
 * Camel Launcher executor implementation
 */

import { existsSync } from 'fs';
import { BaseExecutor } from './BaseExecutor';
import { CamelCommandBuilder } from './builders/CamelCommandBuilder';
import { CamelLauncherExecutorConfig } from './types/ExecutorConfig';

/**
 * Camel Launcher executor implementation
 * Executes Camel Launcher JAR directly using java -jar
 */
export class CamelLauncherExecutor extends BaseExecutor {
	private readonly jarPath: string;

	constructor(config: CamelLauncherExecutorConfig, jarPath: string) {
		// Configure builder to execute JAR using java -jar
		const commandBuilder = new CamelCommandBuilder({
			executable: 'java',
			prefixArgs: ['-jar', jarPath],
		});

		super(config, commandBuilder);
		this.jarPath = jarPath;
	}

	async isAvailable(): Promise<boolean> {
		// Check if the launcher JAR exists
		return existsSync(this.jarPath);
	}
}
