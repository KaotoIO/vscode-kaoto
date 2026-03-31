/**
 * JBang executor implementation
 */

import { execSync } from 'child_process';
import { BaseExecutor } from './BaseExecutor';
import { CamelCommandBuilder } from './builders/CamelCommandBuilder';
import { JBangExecutorConfig } from './types/ExecutorConfig';

/**
 * JBang executor implementation
 */
export class JBangExecutor extends BaseExecutor {
	constructor(config: JBangExecutorConfig) {
		const jbangPath = config.jbangPath || 'jbang';

		// Configure builder for JBang
		const commandBuilder = new CamelCommandBuilder({
			executable: jbangPath,
			prefixArgs: [`-Dcamel.jbang.version=${config.version}`, 'camel@apache/camel'],
		});

		super(config, commandBuilder);
	}

	async isAvailable(): Promise<boolean> {
		try {
			execSync('jbang version', { stdio: 'pipe' });
			return true;
		} catch {
			return false;
		}
	}
}
