/**
 * JBang executor implementation
 */

import { execSync } from 'child_process';
import { BaseExecutor } from './BaseExecutor';
import { CamelCommandBuilder } from './builders/CamelCommandBuilder';
import { JBangExecutorConfig } from './types/ExecutorConfig';
import { DEFAULT_CAMEL_JBANG_VERSION } from '../constants';

/**
 * JBang executor implementation
 */
export class JBangExecutor extends BaseExecutor {
	constructor(config: JBangExecutorConfig) {
		const jbangPath = config.jbangPath || 'jbang';

		// Configure builder for JBang - always use default JBang version from package.json
		const commandBuilder = new CamelCommandBuilder({
			executable: jbangPath,
			prefixArgs: [`-Dcamel.jbang.version=${DEFAULT_CAMEL_JBANG_VERSION}`, 'camel@apache/camel'],
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
