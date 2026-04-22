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

import { ThemeIcon, TreeItem, TreeItemCollapsibleState } from 'vscode';

export interface RunningInfrastructureService {
	name: string;
	port?: number;
	url?: string;
	description?: string;
	args: string[];
	terminalName: string;
	status: 'starting' | 'running' | 'stopping';
	isExternal?: boolean;
}

export class InfrastructureItem extends TreeItem {
	constructor(public readonly service: RunningInfrastructureService) {
		super(service.name, TreeItemCollapsibleState.None);
		this.contextValue = service.isExternal ? 'infrastructure-service-external' : 'infrastructure-service';
		this.iconPath = new ThemeIcon(service.status === 'running' ? 'server-environment' : 'loading~spin');

		const externalLabel = service.isExternal ? ' (external)' : '';
		this.description =
			service.status === 'starting'
				? service.port
					? `Starting on :${service.port}${externalLabel}`
					: `Starting...${externalLabel}`
				: service.status === 'stopping'
					? service.port
						? `Stopping on :${service.port}${externalLabel}`
						: `Stopping...${externalLabel}`
					: service.port
						? `:${service.port}${externalLabel}`
						: service.description
							? `${service.description}${externalLabel}`
							: externalLabel.trim();
		this.tooltip = [
			service.status === 'starting' ? 'Status: Starting' : service.status === 'stopping' ? 'Status: Stopping' : 'Status: Running',
			service.description ? `Service: ${service.description}` : `Service: ${service.name}`,
			service.url ? `URL: ${service.url}` : undefined,
			service.port ? `Port: ${service.port}` : undefined,
			service.args.length > 0 ? `Args: ${service.args.join(' ')}` : undefined,
		]
			.filter(Boolean)
			.join('\n');
	}
}
