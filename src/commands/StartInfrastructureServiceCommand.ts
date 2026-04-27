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

import * as vscode from 'vscode';
import { CamelInfraJBang } from '../helpers/CamelInfraJBang';
import { KaotoOutputChannel } from '../extension/KaotoOutputChannel';
import { CamelInfraRunJBangTask } from '../tasks/CamelInfraRunJBangTask';
import { InfrastructureProvider } from '../views/providers/InfrastructureProvider';
import { DockerErrorDetector } from '../helpers/DockerErrorDetector';

export class StartInfrastructureServiceCommand {
	public static readonly ID_COMMAND = 'kaoto.infrastructure.start';

	constructor(private readonly infrastructureProvider: InfrastructureProvider) {}

	private getServiceTargetUrl(service: { url?: string; port?: number }): string | undefined {
		return service.url ?? (service.port ? `http://localhost:${service.port}` : undefined);
	}

	private showServiceAlreadyRunningMessage(serviceName: string, target?: string): void {
		vscode.window.showInformationMessage(
			target ? `Infrastructure service "${serviceName}" is already running at ${target}.` : `Infrastructure service "${serviceName}" is already running.`,
		);
	}

	public async execute(): Promise<void> {
		try {
			const services = await this.infrastructureProvider.ensureAvailableServicesLoaded();
			if (services.length === 0) {
				vscode.window.showInformationMessage('No infrastructure services are available from Camel JBang infra.');
				return;
			}

			const selectedService = await vscode.window.showQuickPick(
				services.map((service) => ({
					label: service.name,
					description: service.description,
				})),
				{
					title: 'Select infrastructure service',
					placeHolder: 'Choose a Camel Infra service to start',
				},
			);

			if (!selectedService) {
				return;
			}

			// Fast check: in-memory state first
			const existingService = this.infrastructureProvider.getRunningService(selectedService.label);
			if (existingService) {
				const target = this.getServiceTargetUrl(existingService);
				this.showServiceAlreadyRunningMessage(selectedService.label, target);
				return;
			}

			// Slower check: CLI state (only if not in memory)
			const cliRunningService = await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: `Checking if ${selectedService.label} is already running...`,
					cancellable: false,
				},
				async () => this.infrastructureProvider.getCliRunningService(selectedService.label),
			);

			if (cliRunningService) {
				// Register the external service
				this.infrastructureProvider.registerRunningService({
					name: cliRunningService.name,
					description: cliRunningService.description ?? selectedService.description,
					port: cliRunningService.port,
					url: cliRunningService.url,
					args: [],
					terminalName: `${cliRunningService.name} (external)`,
					status: 'running',
					isExternal: true,
				});

				const target = this.getServiceTargetUrl(cliRunningService);
				this.showServiceAlreadyRunningMessage(selectedService.label, target);
				return;
			}

			const portValue = await vscode.window.showInputBox({
				title: `Configure ${selectedService.label}`,
				prompt: 'Enter a port number or leave EMPTY to use the default',
				ignoreFocusOut: true,
				validateInput: (value) => {
					if (!value) {
						return undefined;
					}
					return /^\d+$/.test(value) ? undefined : 'Port must be a valid number.';
				},
			});

			if (portValue === undefined) {
				return;
			}

			const args = [...new CamelInfraJBang().getConfiguredDefaultArgs()];
			const port = portValue ? Number(portValue) : undefined;

			const runTask = CamelInfraRunJBangTask.create(
				selectedService.label,
				{
					port,
					args,
				},
				vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
			);

			await runTask.execute();

			// Final check before registration to prevent race condition
			const finalCheck = this.infrastructureProvider.getRunningService(selectedService.label);
			if (finalCheck) {
				const target = this.getServiceTargetUrl(finalCheck);
				this.showServiceAlreadyRunningMessage(selectedService.label, target);
				return;
			}

			this.infrastructureProvider.registerRunningService({
				name: selectedService.label,
				description: selectedService.description,
				port,
				url: this.getServiceTargetUrl({ port }),
				args,
				terminalName: runTask.name,
				status: 'starting',
			});
		} catch (error) {
			const errorMessage = String(error);
			const dockerError = DockerErrorDetector.detectDockerError(errorMessage);

			if (dockerError) {
				KaotoOutputChannel.logError('[Infrastructure] Docker environment error', error);
				vscode.window.showErrorMessage(dockerError.userMessage);
			} else {
				KaotoOutputChannel.logError('[Infrastructure] Failed to start infrastructure service.', error);
				vscode.window.showWarningMessage(`Unable to start infrastructure service: ${errorMessage}`);
			}
		}
	}
}
