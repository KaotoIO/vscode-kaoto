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

import { ShellExecution, ShellExecutionOptions, workspace } from 'vscode';
import { CamelJBang } from './CamelJBang';
import { KAOTO_CAMEL_JBANG_INFRA_ARGUMENTS_SETTING_ID } from './helpers';

export interface InfraServiceDefinition {
	name: string;
	description?: string;
}

export interface InfraRunningServiceDetails {
	name: string;
	description?: string;
	host?: string;
	port?: number;
	url?: string;
	serviceData?: Record<string, unknown>;
}

export interface InfraRunConfiguration {
	port?: number;
	args: string[];
}

export class CamelInfraJBang extends CamelJBang {
	constructor(jbang: string = 'jbang') {
		super(jbang);
	}

	public list(): ShellExecution {
		return new ShellExecution(this.jbang, [...this.defaultJbangArgs, 'infra', 'list', '--json']);
	}

	public start(service: string, config: InfraRunConfiguration, cwd?: string): ShellExecution {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: cwd ?? undefined,
		};

		const args = [...config.args];
		if (config.port !== undefined && !args.some((arg) => arg === '--port' || arg.startsWith('--port='))) {
			args.unshift(`--port=${config.port}`);
		}

		return new ShellExecution(this.jbang, [...this.defaultJbangArgs, 'infra', 'run', service, ...args], shellExecOptions);
	}

	public stop(service: string): ShellExecution {
		return new ShellExecution(this.jbang, [...this.defaultJbangArgs, 'infra', 'stop', service]);
	}

	public ps(): ShellExecution {
		return new ShellExecution(this.jbang, [...this.defaultJbangArgs, 'infra', 'ps', '--json']);
	}

	public getConfiguredDefaultArgs(): string[] {
		const args = workspace.getConfiguration().get<string[]>(KAOTO_CAMEL_JBANG_INFRA_ARGUMENTS_SETTING_ID);
		return Array.isArray(args) ? args : [];
	}

	public parseAvailableServices(output: string): InfraServiceDefinition[] {
		const parsed = JSON.parse(output) as Array<{ name?: string; alias?: string; description?: string; aliasImplementation?: string }>;
		const services: InfraServiceDefinition[] = [];

		for (const service of parsed) {
			const name = service.alias ?? service.name;
			if (typeof name !== 'string' || name.trim().length === 0) {
				continue;
			}

			const aliasImplementation = service.aliasImplementation?.trim();
			const description = [service.description?.trim(), aliasImplementation ? `Implementations: ${aliasImplementation}` : undefined]
				.filter(Boolean)
				.join(' — ');

			services.push({
				name: name.trim(),
				description: description || undefined,
			});
		}

		return services.sort((a, b) => a.name.localeCompare(b.name));
	}

	public parseRunningServices(output: string): InfraRunningServiceDetails[] {
		const parsed = JSON.parse(output) as Array<{
			name?: string;
			alias?: string;
			description?: string;
			serviceData?: Record<string, unknown>;
		}>;

		const services: InfraRunningServiceDetails[] = [];
		for (const service of parsed) {
			const identifiers = [service.alias, service.name]
				.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
				.map((value) => value.trim());

			if (identifiers.length === 0) {
				continue;
			}

			const serviceData = service.serviceData;
			const host = this.extractHost(serviceData);
			const port = this.extractPort(serviceData);
			const url = host && port ? `http://${host}:${port}` : undefined;

			for (const identifier of new Set(identifiers)) {
				services.push({
					name: identifier,
					description: service.description?.trim() || undefined,
					host,
					port,
					url,
					serviceData,
				});
			}
		}

		return services.sort((a, b) => a.name.localeCompare(b.name));
	}

	private extractPort(serviceData?: Record<string, unknown>): number | undefined {
		if (!serviceData) {
			return undefined;
		}

		const directPort = serviceData.port;
		if (typeof directPort === 'number' && Number.isFinite(directPort)) {
			return directPort;
		}

		if (typeof directPort === 'string') {
			const parsed = Number(directPort);
			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}

		for (const value of Object.values(serviceData)) {
			if (typeof value !== 'string') {
				continue;
			}

			const match = value.match(/:(\d+)(?:\/|$)/);
			if (match) {
				return Number(match[1]);
			}
		}

		return undefined;
	}

	private extractHost(serviceData?: Record<string, unknown>): string | undefined {
		if (!serviceData) {
			return undefined;
		}

		const directHost = serviceData.host;
		if (typeof directHost === 'string' && directHost.trim().length > 0) {
			return directHost.trim();
		}

		for (const value of Object.values(serviceData)) {
			if (typeof value !== 'string') {
				continue;
			}

			const match = value.match(/^(?:[a-z]+:\/\/)?([^:/\s]+):\d+/i);
			if (match) {
				return match[1];
			}
		}

		return undefined;
	}
}
