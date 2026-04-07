import { execSync } from 'child_process';
import { satisfies } from 'compare-versions';
import { RuntimeMavenInformation } from '@kaoto/kaoto';
import { KaotoOutputChannel } from '../extension/KaotoOutputChannel';
import { KaotoCatalogService } from '../services/KaotoCatalogService';
import { findFolderOfPomXml } from './helpers';

/**
 * Utility for detecting Maven runtime information using Camel JBang
 */
export class MavenRuntimeDetector {
	/**
	 * Get runtime information from Maven context using Camel JBang
	 * This uses JBang directly (not through the executor abstraction) as it's a utility function
	 * for detecting existing Maven project configuration
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
			const camelVersion = catalogService.getCamelVersionForCLI(catalog) || '4.18.0';

			let camelJbangVersionToUse: string;
			// This ensures versions lower than 4.13 fall back; 4.13 or newer use the configured version.
			if (satisfies(camelVersion, '>=4.13')) {
				camelJbangVersionToUse = camelVersion;
			} else {
				// Fallback to 4.13.0 for older versions
				camelJbangVersionToUse = '4.13.0';
			}

			const response: string = execSync(`jbang '-Dcamel.jbang.version=${camelJbangVersionToUse}' camel@apache/camel dependency runtime --json pom.xml`, {
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
