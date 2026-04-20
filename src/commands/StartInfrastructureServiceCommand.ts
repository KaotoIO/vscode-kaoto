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

export class StartInfrastructureServiceCommand {
	public static readonly ID_COMMAND = 'kaoto.infrastructure.start';

	constructor(private readonly infrastructureProvider: InfrastructureProvider) {}

	public async execute(): Promise<void> {
		try {
			const services = await this.infrastructureProvider.ensureAvailableServicesLoaded();
			if (services.length === 0) {
				vscode.window.showInformationMessage('No infrastructure services are available from Camel JBang infra.');
				return;
			}

			const picked = await vscode.window.showQuickPick(
				services.map((service) => ({
					label: service.name,
					description: service.description,
				})),
				{
					title: 'Select infrastructure service',
					placeHolder: 'Choose a Camel Infra service to start',
				},
			);

			if (!picked) {
				return;
			}

			const portValue = await vscode.window.showInputBox({
				title: `Configure ${picked.label}`,
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
			const existingService = this.infrastructureProvider.getRunningService(picked.label);

			if (existingService) {
				const target = existingService.url ?? (existingService.port ? `http://localhost:${existingService.port}` : undefined);
				vscode.window.showInformationMessage(
					target
						? `Infrastructure service "${picked.label}" is already running at ${target}.`
						: `Infrastructure service "${picked.label}" is already running.`,
				);
				return;
			}

			const runTask = CamelInfraRunJBangTask.create(
				picked.label,
				{
					port,
					args,
				},
				vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
			);

			await runTask.execute();
			this.infrastructureProvider.registerRunningService({
				name: picked.label,
				description: picked.description,
				port,
				url: port ? `http://localhost:${port}` : undefined,
				args,
				terminalName: runTask.name,
				status: 'starting',
			});
		} catch (error) {
			KaotoOutputChannel.logError('[Infrastructure] Failed to start infrastructure service.', error);
			vscode.window.showWarningMessage(`Unable to start infrastructure service: ${String(error)}`);
		}
	}
}
