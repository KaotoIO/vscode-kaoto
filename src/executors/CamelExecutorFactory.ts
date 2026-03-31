import * as vscode from 'vscode';
import { ICamelExecutor } from './ICamelExecutor';
import { JBangExecutor } from './JBangExecutor';
import { CamelLauncherExecutor } from './CamelLauncherExecutor';
import { CamelLauncherDownloader } from '../services/CamelLauncherDownloader';
import { AnyExecutorConfig, JBangExecutorConfig, CamelLauncherExecutorConfig } from './types/ExecutorConfig';
import { ExecutorType } from './types/ExecutorTypes';
import { KaotoOutputChannel } from '../extension/KaotoOutputChannel';

/**
 * Factory for creating executor instances
 * Type-safe and extensible
 */
export class CamelExecutorFactory {
	private static executorInstance: ICamelExecutor | undefined;
	private static currentConfig: AnyExecutorConfig | undefined;
	private static downloader: CamelLauncherDownloader;
	private static extensionContext: vscode.ExtensionContext | undefined;

	/**
	 * Initialize the factory with extension context
	 * Should be called during extension activation
	 */
	static initialize(context: vscode.ExtensionContext): void {
		this.extensionContext = context;
	}

	/**
	 * Create executor based on configuration
	 */
	static async createExecutor(): Promise<ICamelExecutor> {
		const config = this.loadConfiguration();

		// Reset cache if configuration changed
		if (this.hasConfigChanged(config)) {
			this.resetExecutor();
		}

		// Return cached instance
		if (this.executorInstance) {
			return this.executorInstance;
		}

		// Create new executor
		this.currentConfig = config;
		this.executorInstance = await this.createExecutorForType(config);

		KaotoOutputChannel.logInfo(`Executor initialized: ${config.type} (version: ${config.version})`);

		return this.executorInstance;
	}

	/**
	 * Load configuration from VS Code settings
	 */
	private static loadConfiguration(): AnyExecutorConfig {
		const vscodeConfig = vscode.workspace.getConfiguration();
		const executorType = vscodeConfig.get<ExecutorType>('kaoto.executor.type', 'camel-launcher');

		switch (executorType) {
			case 'jbang':
				return {
					type: 'jbang',
					version: vscodeConfig.get('kaoto.camelJbang.version', '4.18.0'),
					jbangPath: vscodeConfig.get('kaoto.camelJbang.path'),
				} as JBangExecutorConfig;

			case 'camel-launcher':
				return {
					type: 'camel-launcher',
					version: vscodeConfig.get('kaoto.camelLauncher.version', '4.18.0'),
					launcherPath: vscodeConfig.get('kaoto.camelLauncher.path'),
					autoDownload: vscodeConfig.get('kaoto.camelLauncher.autoDownload', true),
					storageLocation: vscodeConfig.get('kaoto.camelLauncher.storageLocation'),
				} as CamelLauncherExecutorConfig;

			default:
				throw new Error(`Unknown executor type: ${executorType}`);
		}
	}

	/**
	 * Create executor for specific type
	 */
	private static async createExecutorForType(config: AnyExecutorConfig): Promise<ICamelExecutor> {
		switch (config.type) {
			case 'jbang':
				return new JBangExecutor(config);

			case 'camel-launcher':
				return await this.createCamelLauncherExecutor(config);

			default:
				throw new Error(`Unknown executor type: ${(config as any).type}`);
		}
	}

	/**
	 * Create Camel Launcher executor with download support
	 */
	private static async createCamelLauncherExecutor(config: CamelLauncherExecutorConfig): Promise<ICamelExecutor> {
		let launcherPath: string;

		if (config.launcherPath) {
			// Use custom path
			launcherPath = config.launcherPath;
			KaotoOutputChannel.logInfo(`Using custom Camel Launcher: ${launcherPath}`);
		} else if (config.autoDownload) {
			// Download launcher
			if (!this.downloader) {
				this.downloader = new CamelLauncherDownloader(this.extensionContext, config.storageLocation);
			}
			launcherPath = await this.downloader.ensureLauncher(config.version);
			KaotoOutputChannel.logInfo(`Using downloaded Camel Launcher: ${launcherPath}`);
		} else {
			throw new Error('Camel Launcher path not specified and auto-download is disabled');
		}

		return new CamelLauncherExecutor(config, launcherPath);
	}

	/**
	 * Check if configuration changed
	 */
	private static hasConfigChanged(newConfig: AnyExecutorConfig): boolean {
		if (!this.currentConfig) {
			return true;
		}

		return this.currentConfig.type !== newConfig.type || this.currentConfig.version !== newConfig.version;
	}

	/**
	 * Reset cached executor
	 */
	static resetExecutor(): void {
		this.executorInstance = undefined;
		this.currentConfig = undefined;
	}

	/**
	 * Get current executor instance (if any)
	 */
	static getCurrentExecutor(): ICamelExecutor | undefined {
		return this.executorInstance;
	}

	/**
	 * Get current configuration (if any)
	 */
	static getCurrentConfig(): AnyExecutorConfig | undefined {
		return this.currentConfig;
	}
}
