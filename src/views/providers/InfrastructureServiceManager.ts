import { exec } from 'child_process';
import { Disposable, tasks, window } from 'vscode';
import { CamelInfraJBang, InfraRunningServiceDetails, InfraServiceDefinition } from '../../helpers/CamelInfraJBang';
import { KaotoOutputChannel } from '../../extension/KaotoOutputChannel';
import { RunningInfrastructureService } from '../infrastructureTreeItems/InfrastructureItem';
import { DockerErrorDetector } from '../../helpers/DockerErrorDetector';

/**
 * Manages infrastructure service lifecycle operations including:
 * - Loading available services
 * - Tracking running services
 * - Service registration/unregistration
 * - CLI interaction for service status
 */
export class InfrastructureServiceManager implements Disposable {
	private readonly availableServices = new Map<string, InfraServiceDefinition>();
	private readonly runningServices = new Map<string, RunningInfrastructureService>();
	private readonly terminalNameToServiceName = new Map<string, string>();
	private servicesLoaded = false;
	private readonly disposables: Disposable[] = [];
	private isStartingService = false;
	private isManualOperationInProgress = false;

	constructor(private readonly onServiceChange: () => void) {
		this.registerTaskListeners();
	}

	dispose(): void {
		this.disposables.forEach((disposable) => disposable.dispose());
		this.disposables.length = 0;
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

			const services = new CamelInfraJBang().extractAvailableServices(output);
			this.availableServices.clear();
			for (const service of services) {
				this.availableServices.set(service.name, service);
			}
			this.servicesLoaded = true;
			KaotoOutputChannel.logInfo(`[InfrastructureServiceManager] Loaded ${services.length} infrastructure services.`);
			return services;
		} catch (error) {
			KaotoOutputChannel.logError('[InfrastructureServiceManager] Failed to load infrastructure services.', error);
			throw error;
		}
	}

	registerRunningService(service: RunningInfrastructureService): void {
		this.runningServices.set(service.name, service);
		this.terminalNameToServiceName.set(service.terminalName, service.name);
		this.onServiceChange();
		void this.waitForRunningService(service.name);
	}

	updateRunningService(name: string, partial: Partial<RunningInfrastructureService>, skipRefresh: boolean = false): void {
		const current = this.runningServices.get(name);
		if (!current) {
			return;
		}
		const updated = { ...current, ...partial };

		// If terminal name changed, update the index
		if (partial.terminalName && partial.terminalName !== current.terminalName) {
			this.terminalNameToServiceName.delete(current.terminalName);
			this.terminalNameToServiceName.set(updated.terminalName, name);
		}

		this.runningServices.set(name, updated);
		if (!skipRefresh) {
			this.onServiceChange();
		}
	}

	unregisterRunningService(name: string): void {
		this.isManualOperationInProgress = true;
		try {
			const service = this.runningServices.get(name);
			if (service) {
				this.terminalNameToServiceName.delete(service.terminalName);
			}
			this.runningServices.delete(name);
			this.onServiceChange();
		} finally {
			this.isManualOperationInProgress = false;
		}
	}

	markServiceStopping(name: string): void {
		this.isManualOperationInProgress = true;
		try {
			this.updateRunningService(name, { status: 'stopping' });
		} finally {
			this.isManualOperationInProgress = false;
		}
	}

	getRunningService(name: string): RunningInfrastructureService | undefined {
		return this.runningServices.get(name);
	}

	getRunningServices(): Map<string, RunningInfrastructureService> {
		return this.runningServices;
	}

	async getCliRunningService(name: string): Promise<InfraRunningServiceDetails | undefined> {
		try {
			const runningByName = await this.fetchRunningServicesByName();
			return runningByName.get(name);
		} catch (error) {
			KaotoOutputChannel.logWarning(`[InfrastructureServiceManager] Unable to fetch CLI running services: ${String(error)}`);
			return undefined;
		}
	}

	getAvailableServices(): InfraServiceDefinition[] {
		return Array.from(this.availableServices.values());
	}

	isServicesLoaded(): boolean {
		return this.servicesLoaded;
	}

	setStartingService(isStarting: boolean): void {
		this.isStartingService = isStarting;
	}

	isServiceStarting(): boolean {
		return this.isStartingService;
	}

	isManualOperation(): boolean {
		return this.isManualOperationInProgress;
	}

	async refreshRunningServicesFromCli(): Promise<boolean> {
		// Skip refresh if a manual operation is in progress to prevent race conditions
		if (this.isManualOperationInProgress) {
			return false;
		}

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
						this.terminalNameToServiceName.delete(currentService.terminalName);
						this.runningServices.delete(name);
						changed = true;
						KaotoOutputChannel.logInfo(`[InfrastructureServiceManager] Removed external service "${name}" - no longer running`);
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
					const terminalName = `${cliService.name} (external)`;
					this.runningServices.set(name, {
						name: cliService.name,
						description: cliService.description,
						port: cliService.port,
						url: cliService.url,
						args: [],
						terminalName: terminalName,
						status: 'running',
						isExternal: true,
					});
					this.terminalNameToServiceName.set(terminalName, name);
					changed = true;
					KaotoOutputChannel.logInfo(`[InfrastructureServiceManager] Discovered external service: ${name}`);
				}
			}

			return changed;
		} catch (error) {
			KaotoOutputChannel.logWarning(`[InfrastructureServiceManager] Unable to refresh running infrastructure services: ${String(error)}`);
			return false;
		}
	}

	private registerTaskListeners(): void {
		this.disposables.push(
			tasks.onDidEndTaskProcess((event) => {
				const taskName = event.execution.task.name;
				const serviceName = this.terminalNameToServiceName.get(taskName);
				if (!serviceName) {
					return;
				}

				// Check if task failed with non-zero exit code
				if (event.exitCode !== undefined && event.exitCode !== 0) {
					void this.handleTaskFailure(serviceName, event.exitCode);
				} else {
					void this.reconcileServiceAfterTaskEnd(serviceName);
				}
			}),
		);
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
				this.onServiceChange();
				KaotoOutputChannel.logInfo(`[InfrastructureServiceManager] Task ended for "${name}" but the infrastructure service is still running.`);
				return;
			}

			this.unregisterRunningService(name);
		} catch (error) {
			const errorMessage = String(error);
			const dockerError = DockerErrorDetector.detectDockerError(errorMessage);

			if (dockerError) {
				KaotoOutputChannel.logError(`[InfrastructureServiceManager] Docker environment error for service "${name}"`, error);
				window.showErrorMessage(dockerError.userMessage);
			} else {
				KaotoOutputChannel.logWarning(
					`[InfrastructureServiceManager] Unable to reconcile infrastructure service "${name}" after task termination: ${errorMessage}`,
				);
			}
			this.onServiceChange();
		}
	}

	private async handleTaskFailure(name: string, exitCode: number): Promise<void> {
		KaotoOutputChannel.logWarning(`[InfrastructureServiceManager] Task for service "${name}" failed with exit code ${exitCode}`);

		// When infrastructure task fails with exit code 1, it's commonly due to Docker not being available
		// Show Docker error message to help users understand the requirement
		if (exitCode === 1) {
			const dockerError = DockerErrorDetector.detectDockerError('Could not find a valid Docker environment');
			if (dockerError) {
				KaotoOutputChannel.logError(
					`[InfrastructureServiceManager] Infrastructure service "${name}" failed to start. This is commonly caused by Docker not being available.`,
				);
				window.showErrorMessage(`Failed to start ${name}: ${dockerError.userMessage}`);
			}
		}

		// Remove the service from running services
		this.unregisterRunningService(name);
	}

	private async fetchRunningServicesByName(): Promise<Map<string, InfraRunningServiceDetails>> {
		const output = await this.executeShellExecution(new CamelInfraJBang().ps());
		const runningServices = new CamelInfraJBang().extractRunningServices(output);
		return new Map<string, InfraRunningServiceDetails>(runningServices.map((service) => [service.name, service]));
	}

	private async waitForRunningService(name: string, timeoutMs: number = 30000, intervalMs: number = 1000): Promise<void> {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const changed = await this.refreshRunningServicesFromCli();

			const service = this.runningServices.get(name);
			if (!service) {
				return;
			}

			if (service.status === 'running') {
				if (changed) {
					this.onServiceChange();
				}
				return;
			}

			await new Promise((resolve) => setTimeout(resolve, intervalMs));
		}

		KaotoOutputChannel.logWarning(`[InfrastructureServiceManager] Timeout waiting for infrastructure service "${name}" to become available.`);
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
