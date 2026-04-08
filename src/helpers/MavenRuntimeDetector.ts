import { execSync } from 'child_process';
import { satisfies } from 'compare-versions';
import { RuntimeMavenInformation } from '@kaoto/kaoto';
import { KaotoOutputChannel } from '../extension/KaotoOutputChannel';
import { KaotoCatalogService } from '../services/KaotoCatalogService';
import { CamelExecutorFactory } from '../executors/CamelExecutorFactory';
import { findFolderOfPomXml } from './helpers';
import { DEFAULT_CAMEL_VERSION } from '../constants';

/**
 * Utility for detecting Maven runtime information from pom.xml
 */
export class MavenRuntimeDetector {
	/**
	 * Get runtime information from Maven context using the configured executor
	 * This uses the Camel CLI to detect existing Maven project configuration
	 */
	public static async getRuntimeInfoFromMavenContext(integrationFilePath: string): Promise<RuntimeMavenInformation | undefined> {
		const folderOfPomXml = findFolderOfPomXml(integrationFilePath);
		if (folderOfPomXml === undefined) {
			return undefined;
		}

		try {
			// Get Camel version from catalog service
			const catalogService = KaotoCatalogService.getInstance();
			const catalog = catalogService.getDefaultIntegrationCatalog();
			const camelVersion = catalogService.getCamelVersionForCLI(catalog) || DEFAULT_CAMEL_VERSION;

			let camelVersionToUse: string;
			// This ensures versions lower than 4.13 fall back; 4.13 or newer use the configured version.
			if (satisfies(camelVersion, '>=4.13')) {
				camelVersionToUse = camelVersion;
			} else {
				// Fallback to 4.13.0 for older versions
				camelVersionToUse = '4.13.0';
			}

			// Get executor configuration to build the correct command
			const executor = await CamelExecutorFactory.createExecutor();
			const config = executor.getConfig();

			// Build command string based on executor type
			let fullCommand: string;
			if (config.type === 'jbang') {
				const jbangPath = (config as any).jbangPath || 'jbang';
				fullCommand = `${jbangPath} -Dcamel.jbang.version=${camelVersionToUse} camel@apache/camel dependency runtime --json pom.xml`;
			} else {
				// For camel-launcher, get the launcher path from the executor
				const launcherPath = (executor as any).launcherPath;
				fullCommand = `${launcherPath} dependency runtime --json pom.xml`;
			}

			const response: string = execSync(fullCommand, {
				stdio: 'pipe',
				cwd: folderOfPomXml,
			}).toString();

			return JSON.parse(response) as RuntimeMavenInformation;
		} catch (ex) {
			KaotoOutputChannel.logError('Error while trying to retrieve the runtime information from Maven context', ex);
			return undefined;
		}
	}
}
