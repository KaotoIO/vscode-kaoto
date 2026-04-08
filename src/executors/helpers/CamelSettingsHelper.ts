/**
 * Helper for reading and processing Camel-related user settings
 * Provides consistent settings access for all executors
 */

import { workspace, window, Uri, RelativePattern } from 'vscode';
import { dirname } from 'path';
import { satisfies } from 'compare-versions';
import { KaotoOutputChannel } from '../../extension/KaotoOutputChannel';
import { ArgumentConflict, ArgumentConflictDetector } from '../../helpers/ArgumentConflictDetector';
import { KaotoCatalogService } from '../../services/KaotoCatalogService';
import {
	KAOTO_CAMEL_JBANG_RUN_ARGUMENTS_SETTING_ID,
	KAOTO_CAMEL_JBANG_RUN_SOURCE_DIR_ARGUMENTS_SETTING_ID,
	KAOTO_MAVEN_CAMEL_JBANG_EXPORT_FOLDER_ARGUMENTS_SETTING_ID,
	KAOTO_LOCAL_KAMELET_DIRECTORIES_SETTING_ID,
	KAOTO_CAMEL_JBANG_RED_HAT_MAVEN_REPOSITORY_SETTING_ID,
	KAOTO_CAMEL_JBANG_RED_HAT_MAVEN_REPOSITORY_GLOBAL_SETTING_ID,
	resolvePaths,
} from '../../helpers/helpers';

export interface ProcessedArguments {
	args: string[];
	conflicts: ArgumentConflict[];
}

/**
 * Helper class for processing Camel settings and arguments
 */
export class CamelSettingsHelper {
	private readonly camelVersion: string;

	constructor() {
		// Get version from catalog service
		const catalogService = KaotoCatalogService.getInstance();
		const catalog = catalogService.getDefaultIntegrationCatalog();
		this.camelVersion = catalogService.getCamelVersionForCLI(catalog) || '';
	}

	/**
	 * Get processed run arguments with user settings
	 */
	async getRunArguments(filePath: string, cwd: string): Promise<ProcessedArguments> {
		const runArgs = workspace.getConfiguration().get(KAOTO_CAMEL_JBANG_RUN_ARGUMENTS_SETTING_ID) as string[];
		const xslFilteredArgs = await this.handleMissingXslFiles(filePath, runArgs);
		const processedArgs = await this.handleLocalKameletDirArgument(xslFilteredArgs, cwd);

		// Merge with hardcoded --console argument
		const codeArgs = ['--console'];
		const result = ArgumentConflictDetector.mergeArguments(codeArgs, processedArgs, 'run');

		return { args: result.merged, conflicts: result.conflicts };
	}

	/**
	 * Get processed run source directory arguments with user settings
	 */
	async getRunSourceDirArguments(cwd: string): Promise<ProcessedArguments> {
		const runArgs = workspace.getConfiguration().get(KAOTO_CAMEL_JBANG_RUN_SOURCE_DIR_ARGUMENTS_SETTING_ID) as string[];
		const processedArgs = await this.handleLocalKameletDirArgument(runArgs, cwd);

		// Merge with hardcoded --console argument
		const codeArgs = ['--console'];
		const result = ArgumentConflictDetector.mergeArguments(codeArgs, processedArgs, 'runSourceDir');

		return { args: result.merged, conflicts: result.conflicts };
	}

	/**
	 * Get processed export arguments with user settings
	 */
	async getExportArguments(cwd: string): Promise<ProcessedArguments> {
		const exportArgs = workspace.getConfiguration().get(KAOTO_MAVEN_CAMEL_JBANG_EXPORT_FOLDER_ARGUMENTS_SETTING_ID) as string[];
		const processedArgs = await this.handleLocalKameletDirArgument(exportArgs, cwd);
		return { args: processedArgs, conflicts: [] };
	}

	/**
	 * Get port argument and resolve the actual port number
	 */
	getPortArgument(port?: number, userArgs: string[] = []): { argument: string; resolvedPort: number } {
		// Check if user has defined --management-port or --port
		const userDefinedPort = ArgumentConflictDetector.extractPortValue(userArgs);

		if (userDefinedPort !== undefined) {
			// User setting takes priority, don't add code default
			return { argument: '', resolvedPort: userDefinedPort };
		}

		// Use code defaults - always use the allocated port, never -1
		const useManagementPort = satisfies(this.camelVersion, '>=4.14');
		const effectivePort = port ?? 8080;
		const argument = useManagementPort ? `--management-port=${effectivePort}` : `--port=${effectivePort}`;

		return { argument, resolvedPort: effectivePort };
	}

	/**
	 * Get Camel version argument from catalog selection
	 */
	getCamelVersionArgument(userArgs: string[] = []): string {
		// Check if user has defined --camel-version
		if (ArgumentConflictDetector.hasArgument(userArgs, 'camel-version')) {
			return '';
		}

		// Get version from catalog service
		const catalogService = KaotoCatalogService.getInstance();
		const catalog = catalogService.getDefaultIntegrationCatalog();
		const camelVersion = catalogService.getCamelVersionForCLI(catalog);

		return camelVersion ? `--camel-version=${camelVersion}` : '';
	}

	/**
	 * Get Red Hat Maven repository argument if needed
	 */
	getRedHatMavenRepositoryArgument(userArgs: string[] = []): string {
		// Check if user has defined --repos
		if (ArgumentConflictDetector.hasArgument(userArgs, 'repos')) {
			return '';
		}

		const camelVersionArg = this.getCamelVersionArgument(userArgs);
		if (camelVersionArg.includes('redhat')) {
			const url = workspace.getConfiguration().get(KAOTO_CAMEL_JBANG_RED_HAT_MAVEN_REPOSITORY_SETTING_ID) as string;
			const reposPlaceholder = this.getCamelGlobalRepos();
			return url ? `--repos=${reposPlaceholder}${url}` : '';
		}
		return '';
	}

	/**
	 * Show warnings for detected argument conflicts
	 */
	async showConflictWarnings(conflicts: ArgumentConflict[]): Promise<void> {
		if (conflicts.length === 0) {
			return;
		}

		const message =
			`Camel argument conflicts detected (user settings override code defaults):\n` +
			conflicts.map((c) => `  - ${c.argument}: code="${c.codeValue}" overridden by user="${c.userValue}"`).join('\n');

		KaotoOutputChannel.logWarning(message);

		const selection = await window.showInformationMessage(
			`Camel: ${conflicts.length} argument(s) overridden by user settings. Check output for details.`,
			'View Output',
		);
		if (selection === 'View Output') {
			KaotoOutputChannel.getInstance().show();
		}
	}

	/**
	 * Handle local kamelet directory argument
	 */
	private async handleLocalKameletDirArgument(runArgs: string[], cwd: string): Promise<string[]> {
		const localKameletDirIndex = runArgs.findIndex((parameter) => parameter.startsWith('--local-kamelet-dir'));

		// If already present, resolve paths
		if (localKameletDirIndex !== -1) {
			runArgs[localKameletDirIndex] = await this.resolveAlreadyExistingLocalKameletDirArgument(runArgs[localKameletDirIndex], cwd);
			return runArgs;
		}

		// Try to get from global setting
		const localKameletDirectoriesGlobalArgument = await this.resolveLocalKameletDirsFromGlobalSetting(cwd);
		if (!localKameletDirectoriesGlobalArgument) {
			return runArgs;
		}

		return [...runArgs, localKameletDirectoriesGlobalArgument];
	}

	/**
	 * Resolve existing local kamelet directory argument
	 */
	private async resolveAlreadyExistingLocalKameletDirArgument(existingKameletDirArgument: string, cwd: string): Promise<string> {
		const kameletDirPaths = existingKameletDirArgument
			.replace('--local-kamelet-dir=', '')
			.split(',')
			.map((path) => path.trim());
		const resolvedKameletDirPaths = resolvePaths(kameletDirPaths, cwd);
		return `'--local-kamelet-dir=${Array.from(resolvedKameletDirPaths).join(',')}'`;
	}

	/**
	 * Resolve local kamelet directories from global setting
	 */
	private async resolveLocalKameletDirsFromGlobalSetting(cwd: string): Promise<string | undefined> {
		const localKameletDirectories = workspace.getConfiguration().get(KAOTO_LOCAL_KAMELET_DIRECTORIES_SETTING_ID) as string[];
		if (localKameletDirectories.length > 0) {
			return `'--local-kamelet-dir=${Array.from(resolvePaths(localKameletDirectories, cwd)).join(',')}'`;
		}
		return undefined;
	}

	/**
	 * Get Camel global repos prefix
	 */
	private getCamelGlobalRepos(): string {
		const globalRepos = workspace.getConfiguration().get(KAOTO_CAMEL_JBANG_RED_HAT_MAVEN_REPOSITORY_GLOBAL_SETTING_ID) as boolean;
		return globalRepos ? '#repos,' : '';
	}

	/**
	 * Handle missing XSL files in run arguments
	 * Mainly in ZSH shell there is problem when Camel is executed with non existing files
	 * added using '*.xsl' file pattern - it is caused by null glob option disabled by default for ZSH shell
	 */
	private async handleMissingXslFiles(filePath: string, runArgs: string[]): Promise<string[]> {
		const folderUri = Uri.file(dirname(filePath));
		const xsls = await workspace.findFiles(new RelativePattern(folderUri, '*.xsl'));
		if (xsls.length > 0) {
			return runArgs; // don't modify default run arguments which should contain *.xsl
		} else {
			return runArgs.filter((parameter) => parameter !== '*.xsl');
		}
	}
}
