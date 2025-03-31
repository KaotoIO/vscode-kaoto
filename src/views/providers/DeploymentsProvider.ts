/**
 * Copyright 2025 Red Hat, Inc. and/or its affiliates.
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
import { EventEmitter, tasks, TreeDataProvider, TreeItem, TreeItemCollapsibleState, workspace } from 'vscode';
import { basename } from 'path';
import { PortManager } from '../../helpers/PortManager';
import { CamelJBangTaskDefinition } from '../../tasks/CamelJBangTask';
import { KaotoOutputChannel } from '../../extension/KaotoOutputChannel';
import { Route } from '../deploymentTreeItems/Route';
import { RootItem } from '../deploymentTreeItems/RootItem';
import { ParentItem } from '../deploymentTreeItems/ParentItem';
import { ChildItem } from '../deploymentTreeItems/ChildItem';

export class DeploymentsProvider implements TreeDataProvider<TreeItem> {
	private readonly _onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private static readonly SETTINGS_REFRESH_INTERVAL = 'kaoto.deployments.refresh.interval';

	private readonly CONTEXT_LOCALHOST_ITEM = 'root-localhost';
	private readonly CONTEXT_INTEGRATION_LOCALHOST_ITEM = 'parent-localhost';
	private readonly CONTEXT_ROUTE_LOCALHOST_ITEM = 'child-localhost';

	private interval: number;
	private autoRefreshHandle?: NodeJS.Timeout;
	private localhostData = new Map<string, { associatedFile: string; routes: Route[] }>();

	constructor(private readonly portManager: PortManager) {
		this.interval = this.getRefreshInterval();
		this.startAutoRefresh();

		workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration(DeploymentsProvider.SETTINGS_REFRESH_INTERVAL)) {
				this.updateIntervalFromSettings();
			}
		});

		tasks.onDidStartTaskProcess((e) => {
			const def = e.execution.task.definition as CamelJBangTaskDefinition;
			if (def.type === 'camel-jbang' && def.port) {
				console.log(`[DeploymentsProvider] Task started on port ${def.port}`);
				this.refresh();
			}
		});
		tasks.onDidEndTaskProcess((e) => {
			const def = e.execution.task.definition as CamelJBangTaskDefinition;
			if (def.type === 'camel-jbang' && def.port) {
				console.log(`[DeploymentsProvider] Task ended on port ${def.port}`);
				this.portManager.releasePort(def.port);
				this.refresh();
			}
		});
	}

	dispose(): void {
		this.stopAutoRefresh();
	}

	refresh(): void {
		console.log('[DeploymentsProvider] Refreshing data...');
		void this.updateData();
	}

	getTreeItem(element: TreeItem): TreeItem {
		return element;
	}

	async getChildren(element?: TreeItem): Promise<TreeItem[]> {
		if (!element) {
			return [new RootItem('Localhost', 'desktop-download', this.CONTEXT_LOCALHOST_ITEM)];
		}

		if (element.contextValue === this.CONTEXT_LOCALHOST_ITEM) {
			return Array.from(this.localhostData.entries()).map(([key, data]) => {
				const k = PortFileKey.fromString(key);
				return new ParentItem(
					this.getDisplayName(k.file),
					data.routes.length ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None,
					this.CONTEXT_INTEGRATION_LOCALHOST_ITEM,
					k.port,
					basename(k.file),
					data.associatedFile,
				);
			});
		}

		if (element.contextValue === this.CONTEXT_INTEGRATION_LOCALHOST_ITEM) {
			const parentItem = element as ParentItem;
			const key = new PortFileKey(parentItem.port, parentItem.description as string); // description stores a file name
			const data = this.localhostData.get(key.toString());
			return (
				data?.routes.map(
					(route) => new ChildItem(parentItem, route.routeId, TreeItemCollapsibleState.None, this.CONTEXT_ROUTE_LOCALHOST_ITEM, route),
				) || []
			);
		}

		return [];
	}

	private async updateData(): Promise<void> {
		this.localhostData = await this.fetchLocalhostRoutes();

		if (this.portManager.getUsedPorts().size > 0) {
			this.startAutoRefresh();
		} else {
			this.stopAutoRefresh();
		}
		this._onDidChangeTreeData.fire();
	}

	private startAutoRefresh(): void {
		console.log('[DeploymentsProvider] Auto-refreshing data...');
		this.stopAutoRefresh();

		if (this.portManager.getUsedPorts().size === 0) {
			console.warn('[DeploymentsProvider] Auto-refresh paused: no active ports.');
			return;
		}

		console.warn(`[DeploymentsProvider] Auto-refresh started @ ${this.interval}ms`);
		this.autoRefreshHandle = setInterval(() => this.updateData(), this.interval);
	}

	private stopAutoRefresh(): void {
		if (this.autoRefreshHandle) {
			clearInterval(this.autoRefreshHandle);
			this.autoRefreshHandle = undefined;
			console.warn('[DeploymentsProvider] Auto-refresh stopped');
		}
	}

	private restartAutoRefresh(): void {
		this.stopAutoRefresh();
		this.startAutoRefresh();
	}

	private getRefreshInterval(): number {
		return workspace.getConfiguration().get(DeploymentsProvider.SETTINGS_REFRESH_INTERVAL, 5000);
	}

	private updateIntervalFromSettings() {
		this.interval = this.getRefreshInterval();
		this.restartAutoRefresh();
	}

	private getDisplayName(fileName: string): string {
		return fileName.replace(/(\.camel\.yaml|\.camel\.xml|\.pipe\.yaml|-pipe\.yaml)$/, '');
	}

	private async fetchLocalhostRoutes(): Promise<Map<string, { associatedFile: string; routes: Route[] }>> {
		const deployments = new Map<string, { associatedFile: string; routes: Route[] }>();
		const ports = [...this.portManager.getUsedPorts()].sort((a, b) => b - a);

		const fetchTasks = ports.map(async (port) => {
			try {
				const reachable = await this.portManager.waitForPortReachable(port);
				if (!reachable) {
					this.portManager.releasePort(port);
					return;
				}

				const data = await this.fetchFromConsole(port);
				if (!data?.route?.routes?.length) {
					return;
				}

				for (const r of data.route.routes) {
					const route = new Route(r.routeId, r.source, r.from, r.remote, r.state, r.uptime, r.statistics);
					const file = basename(route.associatedFile);

					const keyStr = new PortFileKey(port, file).toString();
					if (!deployments.has(keyStr)) {
						deployments.set(keyStr, { associatedFile: route.associatedFile, routes: [] });
					}
					deployments.get(keyStr)!.routes.push(route);
				}
			} catch (err) {
				KaotoOutputChannel.logError(`[DeploymentsProvider] Port ${port} fetch error:`, err);
				this.portManager.releasePort(port);
			}
		});

		await Promise.allSettled(fetchTasks);
		return new Map([...deployments.entries()].sort(([a], [b]) => b.localeCompare(a)));
	}

	private async fetchFromConsole(port: number): Promise<any> {
		const response = await fetch(`http://localhost:${port}/q/dev/route`, {
			headers: { Accept: 'application/json' },
		});
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
		return await response.json();
	}

	public async waitUntilRouteHasState(
		port: number,
		routeId: string,
		expectedState: 'Started' | 'Suspended' | 'Stopped',
		timeoutMs: number = 10_000,
		intervalMs: number = 250,
	): Promise<boolean> {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			try {
				const data = await this.fetchFromConsole(port);
				const routes = data?.route?.routes ?? [];

				const targetRoute = routes.find((route: any) => route.routeId === routeId);
				if (targetRoute?.state === expectedState) {
					return true;
				}
			} catch (err) {
				// ignore fetch failures (e.g., server not ready)
			}
			await new Promise((resolve) => setTimeout(resolve, intervalMs));
		}

		KaotoOutputChannel.logWarning(
			`[DeploymentsProvider] Timeout: route "${routeId}" on port ${port} did not reach state "${expectedState}" within ${timeoutMs}ms.`,
		);
		return false;
	}
}

export class PortFileKey {
	constructor(
		public readonly port: number,
		public readonly file: string,
	) {}

	toString(): string {
		return `${this.port}::${this.file}`;
	}

	static fromString(key: string): PortFileKey {
		const [portStr, ...fileParts] = key.split('::');
		return new PortFileKey(Number(portStr), fileParts.join('::'));
	}
}
