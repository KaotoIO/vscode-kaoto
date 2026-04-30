import { commands, Disposable, Event, EventEmitter, TreeDataProvider, TreeItem } from 'vscode';
import { InfraRunningServiceDetails, InfraServiceDefinition } from '../../helpers/CamelInfraJBang';
import { InfrastructureItem, RunningInfrastructureService } from '../infrastructureTreeItems/InfrastructureItem';
import { InfrastructureServiceManager } from './InfrastructureServiceManager';
import { InfrastructureRefreshManager } from './InfrastructureRefreshManager';

/**
 * Tree data provider for infrastructure services view.
 * Delegates service lifecycle management to InfrastructureServiceManager
 * and auto-refresh logic to InfrastructureRefreshManager.
 */
export class InfrastructureProvider implements TreeDataProvider<TreeItem>, Disposable {
	private readonly _onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private readonly serviceManager: InfrastructureServiceManager;
	private readonly refreshManager: InfrastructureRefreshManager;
	private readonly disposables: Disposable[] = [];

	constructor() {
		this.serviceManager = new InfrastructureServiceManager(() => this.handleServiceChange());
		this.refreshManager = new InfrastructureRefreshManager(() => this.handleAutoRefresh());
		this.disposables.push(this.serviceManager, this.refreshManager);
	}

	dispose(): void {
		this.disposables.forEach((disposable) => disposable.dispose());
		this.disposables.length = 0;
	}

	refresh(): void {
		void this.refreshRunningServicesFromCli();
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: TreeItem): TreeItem {
		return element;
	}

	async getChildren(): Promise<TreeItem[]> {
		await this.refreshRunningServicesFromCli(false);
		this.updateContexts();
		return Array.from(this.serviceManager.getRunningServices().values())
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((service) => new InfrastructureItem(service));
	}

	async ensureAvailableServicesLoaded(forceRefresh: boolean = false): Promise<InfraServiceDefinition[]> {
		const services = await this.serviceManager.ensureAvailableServicesLoaded(forceRefresh);
		this.updateContexts();
		return services;
	}

	registerRunningService(service: RunningInfrastructureService): void {
		this.serviceManager.registerRunningService(service);
		this.updateAutoRefreshState();
		this._onDidChangeTreeData.fire();
	}

	updateRunningService(name: string, partial: Partial<RunningInfrastructureService>, skipRefresh: boolean = false): void {
		this.serviceManager.updateRunningService(name, partial, skipRefresh);
		if (!skipRefresh) {
			this.refresh();
		}
	}

	unregisterRunningService(name: string): void {
		this.serviceManager.unregisterRunningService(name);
		this.updateAutoRefreshState();
	}

	markServiceStopping(name: string): void {
		this.serviceManager.markServiceStopping(name);
	}

	getRunningService(name: string): RunningInfrastructureService | undefined {
		return this.serviceManager.getRunningService(name);
	}

	async getCliRunningService(name: string): Promise<InfraRunningServiceDetails | undefined> {
		return await this.serviceManager.getCliRunningService(name);
	}

	getAvailableServices(): InfraServiceDefinition[] {
		return this.serviceManager.getAvailableServices();
	}

	setStartingService(isStarting: boolean): void {
		this.serviceManager.setStartingService(isStarting);
		this.updateContexts();
	}

	isServiceStarting(): boolean {
		return this.serviceManager.isServiceStarting();
	}

	private updateContexts(): void {
		commands.executeCommand('setContext', 'kaoto.infrastructureCatalogLoaded', this.serviceManager.isServicesLoaded());
		commands.executeCommand('setContext', 'kaoto.infrastructureRunning', this.serviceManager.getRunningServices().size > 0);
		commands.executeCommand('setContext', 'kaoto.infrastructureStarting', this.serviceManager.isServiceStarting());
	}

	private handleServiceChange(): void {
		this.updateAutoRefreshState();
		this._onDidChangeTreeData.fire();
	}

	private async handleAutoRefresh(): Promise<void> {
		await this.refreshRunningServicesFromCli();
	}

	private async refreshRunningServicesFromCli(fireChangeEvent: boolean = true): Promise<void> {
		const changed = await this.serviceManager.refreshRunningServicesFromCli();
		this.updateAutoRefreshState();
		if (changed && fireChangeEvent) {
			this._onDidChangeTreeData.fire();
		}
	}

	private updateAutoRefreshState(): void {
		const hasRunningServices = this.serviceManager.getRunningServices().size > 0;
		if (hasRunningServices) {
			this.refreshManager.startAutoRefresh();
		} else {
			this.refreshManager.stopAutoRefresh();
		}
		this.updateContexts();
	}
}
