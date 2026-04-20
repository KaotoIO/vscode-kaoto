import { Disposable, workspace } from 'vscode';
import { KAOTO_VIEWS_REFRESH_INTERVAL_SETTING_ID } from '../../constants';
import { KaotoOutputChannel } from '../../extension/KaotoOutputChannel';

/**
 * Manages auto-refresh functionality for infrastructure services.
 * Handles periodic refresh intervals and configuration changes.
 */
export class InfrastructureRefreshManager implements Disposable {
	private refreshInterval: number;
	private autoRefreshHandle?: NodeJS.Timeout;
	private readonly disposables: Disposable[] = [];

	constructor(private readonly onRefresh: () => Promise<void>) {
		this.refreshInterval = this.getRefreshInterval();
		this.registerConfigurationListener();
	}

	dispose(): void {
		this.stopAutoRefresh();
		this.disposables.forEach((disposable) => disposable.dispose());
		this.disposables.length = 0;
	}

	startAutoRefresh(): void {
		this.stopAutoRefresh();
		this.autoRefreshHandle = setInterval(() => {
			// Auto-refresh will be skipped if manual operation is in progress
			this.onRefresh().catch((error) => {
				KaotoOutputChannel.logError('[Infrastructure] Auto-refresh failed', error);
			});
		}, this.refreshInterval);
	}

	stopAutoRefresh(): void {
		if (this.autoRefreshHandle) {
			clearInterval(this.autoRefreshHandle);
			this.autoRefreshHandle = undefined;
		}
	}

	private restartAutoRefresh(): void {
		// Only restart if there's an active refresh handle
		if (this.autoRefreshHandle) {
			this.startAutoRefresh();
		}
	}

	private getRefreshInterval(): number {
		return workspace.getConfiguration().get(KAOTO_VIEWS_REFRESH_INTERVAL_SETTING_ID, 5000);
	}

	private registerConfigurationListener(): void {
		this.disposables.push(
			workspace.onDidChangeConfiguration((event) => {
				if (event.affectsConfiguration(KAOTO_VIEWS_REFRESH_INTERVAL_SETTING_ID)) {
					this.refreshInterval = this.getRefreshInterval();
					this.restartAutoRefresh();
				}
			}),
		);
	}
}
