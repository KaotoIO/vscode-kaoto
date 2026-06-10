import { execSync } from 'child_process';
import { Uri } from 'vscode';
import { CatalogLibraryEntry } from '@kaoto/camel-catalog/types';
import { BaseExecutor } from './BaseExecutor';
import { CommandBuilderConfig } from './builders/CamelCommandBuilder';
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
			prefixArgs: [`-Dcamel.jbang.version=${cliVersion}`, ...runtimeSystemProps, 'camel@apache/camel'],
		};
	}

	private getRuntimeSystemProperties(catalogService: KaotoCatalogService, catalog: CatalogLibraryEntry | undefined): string[] {
		if (!catalog) {
			return [];
		}

		const runtime = catalogService.getRuntimeForCLI(catalog);
		const version = catalogService.getCamelVersionForCLI(catalog, 'jbang');

		if (!version) {
			return [];
		}

		const properties: string[] = [];

		if (runtime === RuntimeType.QUARKUS) {
			properties.push(`-Dcamel.jbang.quarkusVersion=${version}`);

			if (isRedHatBuild(version)) {
				properties.push(
					'-Dcamel.jbang.quarkusGroupId=com.redhat.quarkus.platform',
					'-Dcamel.jbang.quarkus.platform.url=https://registry.quarkus.redhat.com/client/platforms',
					'-Dcamel.jbang.quarkusExtensionRegistryBaseUri=https://registry.quarkus.redhat.com/',
				);
			}
		} else if (runtime === RuntimeType.SPRING_BOOT) {
			properties.push(`-Dcamel.jbang.camelSpringBootVersion=${version}`, `-Dcamel.jbang.springBootVersion=${catalog.frameworkVersion}`);
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
