/**
 * Copyright 2026 Red Hat, Inc. and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { exec } from 'child_process';
import { commands, Disposable, Event, EventEmitter, tasks, TreeDataProvider, TreeItem, window, workspace } from 'vscode';
import { CamelInfraJBang, InfraRunningServiceDetails, InfraServiceDefinition } from '../../helpers/CamelInfraJBang';
import { KaotoOutputChannel } from '../../extension/KaotoOutputChannel';
import { InfrastructureItem, RunningInfrastructureService } from '../infrastructureTreeItems/InfrastructureItem';
import { DockerErrorDetector } from '../../helpers/DockerErrorDetector';

export class InfrastructureProvider implements TreeDataProvider<TreeItem>, Disposable {
	private static readonly SETTINGS_REFRESH_INTERVAL = 'kaoto.views.refresh.interval';

	private readonly _onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private readonly availableServices = new Map<string, InfraServiceDefinition>();
	private readonly runningServices = new Map<string, RunningInfrastructureService>();
	private servicesLoaded = false;
	private refreshInterval: number;
	private autoRefreshHandle?: NodeJS.Timeout;
	private readonly disposables: Disposable[] = [];
	private isStartingService = false;

	constructor() {
		this.refreshInterval = this.getRefreshInterval();
		this.registerLifecycleListeners();
	}

	dispose(): void {
		this.stopAutoRefresh();
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
		return Array.from(this.runningServices.values())
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((service) => new InfrastructureItem(service));
	}

	async ensureAvailableServicesLoaded(forceRefresh: boolean = false): Promise<InfraServiceDefinition[]> {
		if (this.servicesLoaded && !forceRefresh) {
			return Array.from(this.availableServices.values());
		}

		try {
			const output = await window.withProgress(
				{
					location: { viewId: 'kaoto.infrastructure' },
					title: 'Loading infrastructure services...',
				},
				async () => {
					const execution = new CamelInfraJBang().list();
					const command = typeof execution.command === 'string' ? execution.command : (execution.command?.value ?? 'jbang');
					const args = execution.args?.map((arg) => (typeof arg === 'string' ? arg : arg.value)).join(' ') ?? '';
					return await new Promise<string>((resolve, reject) => {
						exec(`${command} ${args}`, (error, stdout, stderr) => {
							if (error) {
								reject(new Error(stderr || error.message));
								return;
							}
							resolve(stdout || stderr);
						});
					});
				},
			);

			const services = new CamelInfraJBang().parseAvailableServices(output);
			this.availableServices.clear();
			for (const service of services) {
				this.availableServices.set(service.name, service);
			}
			this.servicesLoaded = true;
			KaotoOutputChannel.logInfo(`[InfrastructureProvider] Loaded ${services.length} infrastructure services.`);
			this.updateContexts();
			return services;
		} catch (error) {
			KaotoOutputChannel.logError('[InfrastructureProvider] Failed to load infrastructure services.', error);
			throw error;
		}
	}

	registerRunningService(service: RunningInfrastructureService): void {
		this.runningServices.set(service.name, service);
		this.updateAutoRefreshState();
		this._onDidChangeTreeData.fire();
		void this.waitForRunningService(service.name);
	}

	updateRunningService(name: string, partial: Partial<RunningInfrastructureService>, skipRefresh: boolean = false): void {
		const current = this.runningServices.get(name);
		if (!current) {
			return;
		}
		this.runningServices.set(name, { ...current, ...partial });
		if (!skipRefresh) {
			this.refresh();
		}
	}

	unregisterRunningService(name: string): void {
		this.runningServices.delete(name);
		this.updateAutoRefreshState();
		this.refresh();
	}

	markServiceStopping(name: string): void {
		this.updateRunningService(name, { status: 'stopping' });
	}

	getRunningService(name: string): RunningInfrastructureService | undefined {
		return this.runningServices.get(name);
	}

	async getCliRunningService(name: string): Promise<InfraRunningServiceDetails | undefined> {
		try {
			const runningByName = await this.fetchRunningServicesByName();
			return runningByName.get(name);
		} catch (error) {
			KaotoOutputChannel.logWarning(`[InfrastructureProvider] Unable to fetch CLI running services: ${String(error)}`);
			return undefined;
		}
	}

	getAvailableServices(): InfraServiceDefinition[] {
		return Array.from(this.availableServices.values());
	}

	private updateContexts(): void {
		void commands.executeCommand('setContext', 'kaoto.infrastructureCatalogLoaded', this.servicesLoaded);
		void commands.executeCommand('setContext', 'kaoto.infrastructureRunning', this.runningServices.size > 0);
		void commands.executeCommand('setContext', 'kaoto.infrastructureStarting', this.isStartingService);
	}

	setStartingService(isStarting: boolean): void {
		this.isStartingService = isStarting;
		this.updateContexts();
	}

	isServiceStarting(): boolean {
		return this.isStartingService;
	}

	private registerLifecycleListeners(): void {
		this.disposables.push(
			workspace.onDidChangeConfiguration((event) => {
				if (event.affectsConfiguration(InfrastructureProvider.SETTINGS_REFRESH_INTERVAL)) {
					this.refreshInterval = this.getRefreshInterval();
					this.restartAutoRefresh();
				}
			}),
		);

		this.disposables.push(
			tasks.onDidEndTaskProcess((event) => {
				const taskName = event.execution.task.name;
				const matchingService = Array.from(this.runningServices.values()).find((service) => service.terminalName === taskName);
				if (!matchingService) {
					return;
				}

				// Check if task failed with non-zero exit code
				if (event.exitCode !== undefined && event.exitCode !== 0) {
					void this.handleTaskFailure(matchingService.name, event.exitCode);
				} else {
					void this.reconcileServiceAfterTaskEnd(matchingService.name);
				}
			}),
		);
	}

	private async refreshRunningServicesFromCli(fireChangeEvent: boolean = true): Promise<void> {
		try {
			const runningByName = await this.fetchRunningServicesByName();
			let changed = false;

			// Update existing tracked services and remove those no longer running
			for (const [name, currentService] of this.runningServices.entries()) {
				const cliService = runningByName.get(name);
				if (!cliService) {
					// Service is tracked but not running in CLI
					// Only remove external services immediately - managed services might still be starting
					if (currentService.isExternal) {
						this.runningServices.delete(name);
						changed = true;
						KaotoOutputChannel.logInfo(`[InfrastructureProvider] Removed external service "${name}" - no longer running`);
					}
					// For managed services in 'starting' status, keep them - they'll be handled by waitForRunningService timeout
					// For managed services in 'running' or 'stopping' status, keep them - they'll be cleaned up by task end handler
					continue;
				}

				// Update service details but preserve isExternal flag and other managed properties
				this.runningServices.set(name, {
					...currentService,
					description: cliService.description ?? currentService.description,
					port: cliService.port ?? currentService.port,
					url: cliService.url ?? currentService.url,
					status: 'running',
					// Keep isExternal as it was - don't change managed services to external
				});
				changed = true;
			}

			// Register new external services not yet tracked
			for (const [name, cliService] of runningByName.entries()) {
				if (!this.runningServices.has(name)) {
					this.runningServices.set(name, {
						name: cliService.name,
						description: cliService.description,
						port: cliService.port,
						url: cliService.url,
						args: [],
						terminalName: `${cliService.name} (external)`,
						status: 'running',
						isExternal: true,
					});
					changed = true;
					KaotoOutputChannel.logInfo(`[InfrastructureProvider] Discovered external service: ${name}`);
				}
			}

			this.updateAutoRefreshState();
			if (changed && fireChangeEvent) {
				this._onDidChangeTreeData.fire();
			}
		} catch (error) {
			KaotoOutputChannel.logWarning(`[InfrastructureProvider] Unable to refresh running infrastructure services: ${String(error)}`);
		}
	}

	private async reconcileServiceAfterTaskEnd(name: string): Promise<void> {
		try {
			const runningByName = await this.fetchRunningServicesByName();
			if (runningByName.has(name)) {
				const currentService = this.runningServices.get(name);
				const cliService = runningByName.get(name);
				if (!currentService || !cliService) {
					return;
				}

				this.runningServices.set(name, {
					...currentService,
					description: cliService.description ?? currentService.description,
					port: cliService.port ?? currentService.port,
					url: cliService.url ?? currentService.url,
					status: 'running',
				});
				this.updateAutoRefreshState();
				this._onDidChangeTreeData.fire();
				KaotoOutputChannel.logInfo(`[InfrastructureProvider] Task ended for "${name}" but the infrastructure service is still running.`);
				return;
			}

			this.unregisterRunningService(name);
		} catch (error) {
			const errorMessage = String(error);
			const dockerError = DockerErrorDetector.detectDockerError(errorMessage);

			if (dockerError) {
				KaotoOutputChannel.logError(`[InfrastructureProvider] Docker environment error for service "${name}"`, error);
				window.showErrorMessage(dockerError.userMessage);
			} else {
				KaotoOutputChannel.logWarning(
					`[InfrastructureProvider] Unable to reconcile infrastructure service "${name}" after task termination: ${errorMessage}`,
				);
			}
			this.refresh();
		}
	}

	private async handleTaskFailure(name: string, exitCode: number): Promise<void> {
		KaotoOutputChannel.logWarning(`[InfrastructureProvider] Task for service "${name}" failed with exit code ${exitCode}`);

		// When infrastructure task fails with exit code 1, it's commonly due to Docker not being available
		// Show Docker error message to help users understand the requirement
		if (exitCode === 1) {
			const dockerError = DockerErrorDetector.detectDockerError('Could not find a valid Docker environment');
			if (dockerError) {
				KaotoOutputChannel.logError(
					`[InfrastructureProvider] Infrastructure service "${name}" failed to start. This is commonly caused by Docker not being available.`,
				);
				window.showErrorMessage(`Failed to start ${name}: ${dockerError.userMessage}`);
			}
		}

		// Remove the service from running services
		this.unregisterRunningService(name);
	}

	private async fetchRunningServicesByName(): Promise<Map<string, InfraRunningServiceDetails>> {
		const output = await this.executeShellExecution(new CamelInfraJBang().ps());
		const runningServices = new CamelInfraJBang().parseRunningServices(output);
		return new Map<string, InfraRunningServiceDetails>(runningServices.map((service) => [service.name, service]));
	}

	private async waitForRunningService(name: string, timeoutMs: number = 30000, intervalMs: number = 1000): Promise<void> {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			await this.refreshRunningServicesFromCli();

			const service = this.runningServices.get(name);
			if (!service) {
				return;
			}

			if (service.status === 'running') {
				return;
			}

			await new Promise((resolve) => setTimeout(resolve, intervalMs));
		}

		KaotoOutputChannel.logWarning(`[InfrastructureProvider] Timeout waiting for infrastructure service "${name}" to become available.`);
	}

	private updateAutoRefreshState(): void {
		if (this.runningServices.size > 0) {
			this.startAutoRefresh();
		} else {
			this.stopAutoRefresh();
		}
		this.updateContexts();
	}

	private startAutoRefresh(): void {
		this.stopAutoRefresh();
		this.autoRefreshHandle = setInterval(() => {
			void this.refreshRunningServicesFromCli();
		}, this.refreshInterval);
	}

	private stopAutoRefresh(): void {
		if (this.autoRefreshHandle) {
			clearInterval(this.autoRefreshHandle);
			this.autoRefreshHandle = undefined;
		}
	}

	private restartAutoRefresh(): void {
		if (this.runningServices.size > 0) {
			this.startAutoRefresh();
		}
	}

	private getRefreshInterval(): number {
		return workspace.getConfiguration().get(InfrastructureProvider.SETTINGS_REFRESH_INTERVAL, 5000);
	}

	private async executeShellExecution(execution: ReturnType<CamelInfraJBang['list']>): Promise<string> {
		const command = typeof execution.command === 'string' ? execution.command : (execution.command?.value ?? 'jbang');
		const args = execution.args?.map((arg) => (typeof arg === 'string' ? arg : arg.value)).join(' ') ?? '';

		return await new Promise<string>((resolve, reject) => {
			exec(`${command} ${args}`, (error, stdout, stderr) => {
				if (error) {
					reject(new Error(stderr || error.message));
					return;
				}
				resolve(stdout || stderr);
			});
		});
	}
}
