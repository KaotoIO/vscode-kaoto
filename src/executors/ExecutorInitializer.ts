import * as vscode from 'vscode';
import { CamelExecutorFactory } from './CamelExecutorFactory';
import { CamelLauncherDownloader } from '../services/CamelLauncherDownloader';
import { KaotoCatalogService } from '../services/KaotoCatalogService';
import { KaotoOutputChannel } from '../extension/KaotoOutputChannel';
import { DEFAULT_CAMEL_VERSION_FALLBACK, KAOTO_EXECUTOR_TYPE_SETTING_ID } from '../constants';
import { ExtensionContextHandler } from '../extension/ExtensionContextHandler';

/**
 * Ensure executor is available and configured.
 * Handles both JBang and Camel Launcher setup with status bar feedback.
 * @param context - Extension context
 * @param contextHandler - Extension context handler
 * @param forceReinitialize - Force re-initialization even if executor is already available
 */
export async function ensureExecutorAvailable(
	context: vscode.ExtensionContext,
	contextHandler: ExtensionContextHandler,
	forceReinitialize: boolean = false,
): Promise<void> {
	try {
		if (forceReinitialize) {
			CamelExecutorFactory.resetExecutor();
			KaotoOutputChannel.logInfo('Executor cache reset for re-initialization');
		}

		const config = vscode.workspace.getConfiguration();
		const executorType = config.get<string>(KAOTO_EXECUTOR_TYPE_SETTING_ID, 'jbang');

		if (executorType === 'jbang') {
			const jbang = await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Window,
					title: 'Kaoto: Preparing JBang',
					cancellable: false,
				},
				async (progress) => {
					KaotoOutputChannel.logInfo('Checking JBang availability...');
					progress.report({ message: 'Checking JBang on PATH...' });

					const resolvedJbang = await contextHandler.checkJbangOnPath();

					if (!resolvedJbang) {
						return undefined;
					}

					progress.report({ message: 'Configuring trusted JBang sources...' });
					await contextHandler.checkJBangTrustedSources();

					progress.report({ message: 'Verifying Camel JBang plugins...' });
					await contextHandler.checkCamelJBangPlugins();

					progress.report({ message: 'JBang is ready.' });
					return resolvedJbang;
				},
			);

			if (jbang) {
				KaotoOutputChannel.logInfo('JBang is ready');
				vscode.window.setStatusBarMessage('$(check) Kaoto: JBang ready', 3000);

				await contextHandler.setExecutorAvailable(true);
			} else {
				KaotoOutputChannel.logWarning('JBang not found on PATH');
				vscode.window.setStatusBarMessage('$(warning) Kaoto: JBang not found', 5000);

				await contextHandler.setExecutorAvailable(false);
			}
		} else if (executorType === 'camel-launcher') {
			const javaAvailable = await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Window,
					title: 'Kaoto: Preparing Camel Launcher',
					cancellable: false,
				},
				async (progress) => {
					KaotoOutputChannel.logInfo('Checking Java availability...');
					progress.report({ message: 'Checking Java on PATH...' });

					return await contextHandler.checkJavaOnPath();
				},
			);

			if (!javaAvailable) {
				KaotoOutputChannel.logWarning('Java not found on PATH');
				vscode.window.setStatusBarMessage('$(warning) Kaoto: Java not found', 5000);
				await contextHandler.setExecutorAvailable(false);
				return;
			}

			const catalogService = KaotoCatalogService.getInstance();
			const catalog = await catalogService.getSelectedIntegrationCatalog();
			const version = catalogService.getCamelVersionForCLI(catalog, 'camel-launcher') || DEFAULT_CAMEL_VERSION_FALLBACK;
			const downloader = new CamelLauncherDownloader(context);

			const launcherPath = await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Window,
					title: `Kaoto: Preparing Camel Launcher ${version}`,
					cancellable: false,
				},
				async (progress) => {
					progress.report({ message: 'Downloading Camel Launcher and preparing scripts...' });
					KaotoOutputChannel.logInfo(`Downloading Camel Launcher ${version}...`);

					const resolvedLauncherPath = await downloader.ensureLauncher(version);

					progress.report({ message: 'Camel Launcher is ready.' });
					return resolvedLauncherPath;
				},
			);

			KaotoOutputChannel.logInfo(`Camel Launcher ${version} ready at: ${launcherPath}`);
			vscode.window.setStatusBarMessage('$(check) Kaoto: Camel Launcher ready', 3000);

			await contextHandler.setExecutorAvailable(true);
		}
	} catch (error) {
		const isLauncherNotFound = error instanceof Error && error.name === 'LauncherNotFoundError';

		if (isLauncherNotFound) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			KaotoOutputChannel.logWarning(errorMessage);
			vscode.window.showWarningMessage(errorMessage);
		} else {
			const errorMessage = error instanceof Error ? error.message : String(error);
			KaotoOutputChannel.logError('Failed to setup executor', error);
			vscode.window.showWarningMessage(`Failed to setup executor: ${errorMessage}. It will be configured when first needed.`);
		}

		await contextHandler.setExecutorAvailable(false);
	}
}
