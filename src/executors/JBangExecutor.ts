/**
 * JBang executor implementation
 */

import { execSync } from 'child_process';
import { Uri } from 'vscode';
import { BaseExecutor } from './BaseExecutor';
import { CamelCommandBuilder } from './builders/CamelCommandBuilder';
import { JBangExecutorConfig } from './types/ExecutorConfig';
import { CamelCommand, CommandArguments, CommandContext, CommandResult, RuntimeType } from './types/ExecutorTypes';
import { KaotoCatalogService } from '../services/KaotoCatalogService';
import { DEFAULT_CAMEL_VERSION } from '../constants';

/**
 * JBang executor implementation
 */
export class JBangExecutor extends BaseExecutor {
	constructor(config: JBangExecutorConfig) {
		const jbangPath = config.jbangPath || 'jbang';

		// Placeholder builder — execute() builds a dynamic one with catalog-resolved prefix args
		const commandBuilder = new CamelCommandBuilder({
			executable: jbangPath,
			prefixArgs: [],
		});

		super(config, commandBuilder);
	}

	async execute(command: CamelCommand, args: CommandArguments, context?: CommandContext): Promise<CommandResult> {
		if (!(await this.isAvailable())) {
			throw new Error(`Executor ${this.config.type} is not available`);
		}

		const catalogService = KaotoCatalogService.getInstance();
		const resourceUri = context?.cwd ? Uri.file(context.cwd) : undefined;
		const catalog = await catalogService.getSelectedIntegrationCatalog(resourceUri);

		const cliVersion = catalogService.getCliVersionForJBang(catalog) || DEFAULT_CAMEL_VERSION;
		const runtimeSystemProps = await this.getRuntimeSystemProperties(context?.cwd);

		const jbangPath = (this.config as JBangExecutorConfig).jbangPath || 'jbang';
		const prefixArgs = [`-Dcamel.jbang.version=${cliVersion}`, ...runtimeSystemProps, 'camel@apache/camel'];
		const builder = new CamelCommandBuilder({
			executable: jbangPath,
			prefixArgs,
		});

		return builder.buildCommand(command, args, context);
	}

	/**
	 * Get runtime-specific system properties for JBang based on catalog selection
	 */
	private async getRuntimeSystemProperties(cwd?: string): Promise<string[]> {
		try {
			const catalogService = KaotoCatalogService.getInstance();
			const resourceUri = cwd ? Uri.file(cwd) : undefined;
			const catalog = await catalogService.getSelectedIntegrationCatalog(resourceUri);

			if (!catalog) {
				return [];
			}

			const runtime = catalogService.getRuntimeForCLI(catalog);
			const version = catalogService.getCamelVersionForCLI(catalog, 'jbang');

			if (!version) {
				return [];
			}

			const properties: string[] = [];

			// Add runtime-specific system properties only for Quarkus and Spring Boot
			// Main runtime uses --camel-version argument (handled in CamelSettingsHelper)
			if (runtime === RuntimeType.QUARKUS) {
				properties.push(`-Dcamel.jbang.quarkusVersion=${version}`);

				// For Red Hat productized versions
				if (version.includes('redhat')) {
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
		} catch (error) {
			// If catalog service fails, return empty array to avoid breaking execution
			return [];
		}
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
