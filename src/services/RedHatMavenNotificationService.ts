/**
 * Service for managing Red Hat Maven settings notifications
 * Displays info notification when using JBang with Red Hat Camel catalog
 */

import * as vscode from 'vscode';
import { KaotoOutputChannel } from '../extension/KaotoOutputChannel';
import { safeGlobalStateGet, safeGlobalStateUpdate } from '../helpers/helpers';

/**
 * Storage key for "Don't show again" preference
 */
const DONT_SHOW_AGAIN_KEY = 'kaoto.redhat.maven.notification.dontShowAgain';

/**
 * Red Hat Maven repository documentation URL
 */
const RED_HAT_MAVEN_DOCS_URL =
	'https://docs.redhat.com/es/documentation/red_hat_build_of_apache_camel/4.18/html/getting_started_with_red_hat_build_of_apache_camel_for_spring_boot/set-up-maven-locally#add-red-hat-repositories-to-maven';

/**
 * Service for managing Red Hat Maven settings notifications
 */
export class RedHatMavenNotificationService {
	private static instance: RedHatMavenNotificationService;
	private readonly context: vscode.ExtensionContext;

	private constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	/**
	 * Initialize the service with extension context
	 */
	public static initialize(context: vscode.ExtensionContext): RedHatMavenNotificationService {
		if (!RedHatMavenNotificationService.instance) {
			RedHatMavenNotificationService.instance = new RedHatMavenNotificationService(context);
		}
		return RedHatMavenNotificationService.instance;
	}

	/**
	 * Get the singleton instance
	 */
	public static getInstance(): RedHatMavenNotificationService {
		if (!RedHatMavenNotificationService.instance) {
			throw new Error('RedHatMavenNotificationService not initialized. Call initialize() first.');
		}
		return RedHatMavenNotificationService.instance;
	}

	/**
	 * Check if user has chosen "Don't show again"
	 */
	private isDontShowAgainEnabled(): boolean {
		return safeGlobalStateGet(this.context, DONT_SHOW_AGAIN_KEY, false);
	}

	/**
	 * Set "Don't show again" preference
	 */
	private async setDontShowAgain(value: boolean): Promise<void> {
		await safeGlobalStateUpdate(this.context, DONT_SHOW_AGAIN_KEY, value);
		KaotoOutputChannel.logInfo(`Red Hat Maven notification preference updated: dontShowAgain=${value}`);
	}

	/**
	 * Check if the catalog version is a Red Hat build
	 */
	public isRedHatCatalog(catalogVersion: string): boolean {
		return catalogVersion.toLowerCase().includes('redhat');
	}

	/**
	 * Show notification about Red Hat Maven settings requirement
	 * Only shows if:
	 * - User hasn't selected "Don't show again"
	 * - Using JBang executor
	 * - Using Red Hat Camel catalog
	 */
	public async showRedHatMavenNotification(catalogVersion: string, executorType: string): Promise<void> {
		// Check if notification should be shown
		if (this.isDontShowAgainEnabled()) {
			KaotoOutputChannel.logInfo('Red Hat Maven notification suppressed (user selected "Don\'t show again")');
			return;
		}

		// Only show for JBang executor
		if (executorType !== 'jbang') {
			return;
		}

		// Only show for Red Hat catalogs
		if (!this.isRedHatCatalog(catalogVersion)) {
			return;
		}

		KaotoOutputChannel.logInfo(`Showing Red Hat Maven notification for catalog version: ${catalogVersion}`);

		const message =
			`You are using Red Hat Camel catalog (${catalogVersion}) with JBang CLI. ` +
			`Specific Maven settings.xml configuration is required for proper functionality.`;

		const action = await vscode.window.showInformationMessage(message, 'View Documentation', "Don't Show Again");

		if (action === 'View Documentation') {
			await vscode.env.openExternal(vscode.Uri.parse(RED_HAT_MAVEN_DOCS_URL));
			KaotoOutputChannel.logInfo('User opened Red Hat Maven documentation');
		} else if (action === "Don't Show Again") {
			await this.setDontShowAgain(true);
			vscode.window.showInformationMessage('Red Hat Maven notification disabled. You can re-enable it in extension settings.');
		}
	}
}
