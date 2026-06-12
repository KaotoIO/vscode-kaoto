import { execSync } from 'child_process';
import { ShellQuotedString, Uri } from 'vscode';
import { CatalogLibraryEntry } from '@kaoto/camel-catalog/types';
import { BaseExecutor } from './BaseExecutor';
import { CamelCommandBuilder, CommandBuilderConfig } from './builders/CamelCommandBuilder';
import { JBangExecutorConfig } from './types/ExecutorConfig';
import { CommandContext, RuntimeType } from './types/ExecutorTypes';
import { KaotoCatalogService } from '../services/KaotoCatalogService';
import { DEFAULT_CAMEL_VERSION_FALLBACK } from '../constants';
import { isRedHatBuild } from '../helpers/helpers';

export class JBangExecutor extends BaseExecutor {
	private static readonly JBANG_EXECUTABLE = 'jbang';

	constructor(config: JBangExecutorConfig) {
		super(config, {
			executable: JBangExecutor.JBANG_EXECUTABLE,
			prefixArgs: [],
		});
	}

	protected override async buildCommandBuilderConfig(context?: CommandContext): Promise<CommandBuilderConfig> {
		const catalogService = KaotoCatalogService.getInstance();
		const resourceUri = context?.cwd ? Uri.file(context.cwd) : undefined;
		const catalog = await catalogService.getSelectedIntegrationCatalog(resourceUri);

		const cliVersion = catalogService.getCliVersionForJBang(catalog) || DEFAULT_CAMEL_VERSION_FALLBACK;
		const runtimeSystemProps = this.getRuntimeSystemProperties(catalogService, catalog);

		return {
			executable: JBangExecutor.JBANG_EXECUTABLE,
			prefixArgs: [CamelCommandBuilder.strongQuote(`-Dcamel.jbang.version=${cliVersion}`), ...runtimeSystemProps, 'camel@apache/camel'],
		};
	}

	/**
	 * JBang -D system properties use ShellQuoting.Strong to prevent:
	 * - PowerShell: interpreting dots as property access (e.g., -Dcamel.jbang → -Dcamel + .jbang)
	 * - bash: potential issues with special chars in URLs (registry URIs)
	 */
	private getRuntimeSystemProperties(catalogService: KaotoCatalogService, catalog: CatalogLibraryEntry | undefined): ShellQuotedString[] {
		if (!catalog) {
			return [];
		}

		const runtime = catalogService.getRuntimeForCLI(catalog);
		const version = catalogService.getCamelVersionForCLI(catalog, 'jbang');

		if (!version) {
			return [];
		}

		const sq = CamelCommandBuilder.strongQuote;
		const properties: ShellQuotedString[] = [];

		if (runtime === RuntimeType.QUARKUS) {
			properties.push(sq(`-Dcamel.jbang.quarkusVersion=${version}`));

			if (isRedHatBuild(version)) {
				properties.push(
					sq('-Dcamel.jbang.quarkusGroupId=com.redhat.quarkus.platform'),
					sq('-Dcamel.jbang.quarkus.platform.url=https://registry.quarkus.redhat.com/client/platforms'),
					sq('-Dcamel.jbang.quarkusExtensionRegistryBaseUri=https://registry.quarkus.redhat.com/'),
				);
			}
		} else if (runtime === RuntimeType.SPRING_BOOT) {
			properties.push(sq(`-Dcamel.jbang.camelSpringBootVersion=${version}`), sq(`-Dcamel.jbang.springBootVersion=${catalog.frameworkVersion}`));
		}

		return properties;
	}

	async isAvailable(): Promise<boolean> {
		try {
			execSync(`${JBangExecutor.JBANG_EXECUTABLE} version`, { stdio: 'pipe' });
			return true;
		} catch {
			return false;
		}
	}
}
