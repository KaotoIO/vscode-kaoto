/**
 * Camel Launcher executor implementation
 */

import { execSync } from 'child_process';
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
		const commandBuilder = new CamelCommandBuilder({
			executable: 'java',
			prefixArgs: ['-jar', jarPath],
		});

		super(config, commandBuilder);
		this.jarPath = jarPath;
	}

	getJarPath(): string {
		return this.jarPath;
	}

	async isAvailable(): Promise<boolean> {
		if (!existsSync(this.jarPath)) {
			return false;
		}
		try {
			execSync('java -version', { stdio: 'pipe' });
			return true;
		} catch {
			return false;
		}
	}
}
