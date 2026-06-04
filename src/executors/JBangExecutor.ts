/**
 * JBang executor implementation
 */

import { execSync } from 'child_process';
import { Uri } from 'vscode';
import { BaseExecutor } from './BaseExecutor';
import { CamelCommandBuilder } from './builders/CamelCommandBuilder';
import { JBangExecutorConfig } from './types/ExecutorConfig';
import { CamelCommand, CommandArguments, CommandContext, CommandResult } from './types/ExecutorTypes';
import { DEFAULT_CAMEL_JBANG_VERSION } from '../constants';
import { KaotoCatalogService } from '../services/KaotoCatalogService';

/**
 * JBang executor implementation
 */
export class JBangExecutor extends BaseExecutor {
	constructor(config: JBangExecutorConfig) {
		const jbangPath = config.jbangPath || 'jbang';

		// Configure builder for JBang - always use default JBang version from package.json
		// Runtime-specific properties will be added dynamically based on catalog selection
		const commandBuilder = new CamelCommandBuilder({
			executable: jbangPath,
			prefixArgs: [`-Dcamel.jbang.version=${DEFAULT_CAMEL_JBANG_VERSION}`, 'camel@apache/camel'],
		});

		super(config, commandBuilder);
	}

	async execute(command: CamelCommand, args: CommandArguments, context?: CommandContext): Promise<CommandResult> {
		// Get runtime-specific system properties and inject them into the command
		const runtimeSystemProps = await this.getRuntimeSystemProperties(context?.cwd);

		if (runtimeSystemProps.length > 0) {
			// Create a new command builder with runtime-specific properties
			const jbangPath = (this.config as JBangExecutorConfig).jbangPath || 'jbang';
			const enhancedBuilder = new CamelCommandBuilder({
				executable: jbangPath,
				prefixArgs: [`-Dcamel.jbang.version=${DEFAULT_CAMEL_JBANG_VERSION}`, ...runtimeSystemProps, 'camel@apache/camel'],
			});

			// Validate executor is available
			if (!(await this.isAvailable())) {
				throw new Error(`Executor ${this.config.type} is not available`);
			}

			// Build and execute command with enhanced builder
			return enhancedBuilder.buildCommand(command, args, context);
		}

		// Fall back to base implementation if no runtime properties
		return super.execute(command, args, context);
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
			if (runtime === 'quarkus') {
				properties.push(`-Dcamel.jbang.quarkusVersion=${version}`);

				// For Red Hat productized versions
				if (version.includes('redhat')) {
					properties.push(
						'-Dcamel.jbang.quarkusGroupId=com.redhat.quarkus.platform',
						'-Dcamel.jbang.quarkus.platform.url=https://registry.quarkus.redhat.com/client/platforms',
						'-Dcamel.jbang.quarkusExtensionRegistryBaseUri=https://registry.quarkus.redhat.com/',
					);
				}
			} else if (runtime === 'spring-boot') {
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
