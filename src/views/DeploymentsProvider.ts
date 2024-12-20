/**
 * Copyright 2024 Red Hat, Inc. and/or its affiliates.
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
import { Event, EventEmitter, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { join } from 'path';
import { getBasenameIfAbsolute } from '../../src/helpers/helpers';

export class DeploymentsProvider implements TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void> = new EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private intervalId?: NodeJS.Timeout;
    private loading: boolean = true;

    private kubernetesData: Map<string, Route[]> = new Map();
    private localhostData: Map<string, Route[]> = new Map();

    constructor(
        private fetchKubernetesData: () => Promise<Map<string, Route[]>>,
        private localhostPorts: [number, number], // Ports for fetching localhost data
        private interval: number = 30_000 // Default fetch interval: 30 seconds
    ) {
        this.initializeData(); // Fetch initial data
        this.startAutoRefresh(); // Start periodic updates
    }

    refresh(): void {
        console.log('Doing manual refresh of data...');
        this.refreshData(); // Explicitly re-fetch data
    }

    private async refreshData(): Promise<void> {
        try {
            this.dispose(); // Pause auto-refresh

            console.log('Manual refresh started...');
            const localhostData = await this.fetchLocalhostRoutes(this.localhostPorts);
            const kubernetesData = await this.fetchKubernetesData();

            this.localhostData.clear();
            for (const [key, value] of localhostData.entries()) {
                this.localhostData.set(key, value);
            }

            this.kubernetesData.clear();
            for (const [key, value] of kubernetesData.entries()) {
                this.kubernetesData.set(key, value);
            }

            console.log('Manual refresh completed. Updated data:', {
                localhost: this.localhostData,
                kubernetes: this.kubernetesData
            });

            this._onDidChangeTreeData.fire(); // Trigger UI update

            this.startAutoRefresh(); // Resume auto-refresh
        } catch (error) {
            console.error('Error during manual refresh:', error);

            // Ensure auto-refresh is resumed even if an error occurs
            if (!this.intervalId) {
                this.startAutoRefresh();
            }
        }
    }

    dispose(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }

    getTreeItem(element: TreeItem): TreeItem {
        return element;
    }

    async getChildren(element?: RootItem | ParentItem | ChildItem): Promise<TreeItem[]> {
        if (!element) {
            if (this.loading) {
                // Show "Loading..." if data isn't ready yet
                return [new TreeItem('Loading...')];
            }

            // Root nodes
            return [
                new RootItem(
                    'Localhost',
                    'desktop-download',
                    this.localhostData.size > 0
                        ? TreeItemCollapsibleState.Expanded // Expand if data exists
                        : TreeItemCollapsibleState.Collapsed, // Collapse otherwise
                    'root-localhost'
                ),
                new RootItem(
                    'Kubernetes',
                    'cloud-upload',
                    this.kubernetesData.size > 0
                        ? TreeItemCollapsibleState.Expanded // Expand if data exists
                        : TreeItemCollapsibleState.Collapsed, // Collapse otherwise
                    'root-kubernetes'
                )
            ];
        }

        if (element.contextValue === 'root-localhost') {
            return Array.from(this.localhostData.keys()).map(
                (file) =>
                    new ParentItem(
                        this.getDisplayName(file),
                        this.localhostData.get(file)?.length
                            ? TreeItemCollapsibleState.Expanded // Expand if children exist
                            : TreeItemCollapsibleState.None, // None if no children
                        'parent-localhost',
                        file
                    )
            );
        }

        if (element.contextValue === 'root-kubernetes') {
            return Array.from(this.kubernetesData.keys()).map(
                (file) =>
                    new ParentItem(
                        this.getDisplayName(file),
                        this.kubernetesData.get(file)?.length
                            ? TreeItemCollapsibleState.Expanded // Expand if children exist
                            : TreeItemCollapsibleState.None, // None if no children
                        'parent-kubernetes',
                        file
                    )
            );
        }

        if (element.contextValue === 'parent-localhost' && element.label) {
            const children = this.localhostData.get(element.description as string) || [];
            return children.map(
                (route) =>
                    new ChildItem(
                        route.routeId,
                        TreeItemCollapsibleState.None,
                        'child-localhost',
                        element.label,
                        route
                    )
            );
        }

        if (element.contextValue === 'parent-kubernetes' && element.label) {
            const children = this.kubernetesData.get(element.description as string) || [];
            return children.map(
                (route) =>
                    new ChildItem(
                        route.routeId,
                        TreeItemCollapsibleState.None,
                        'child-kubernetes',
                        element.label,
                        route
                    )
            );
        }

        return [];
    }

    private async initializeData(): Promise<void> {
        try {
            console.log('Initializing data...');
            const localhostData = await this.fetchLocalhostRoutes(this.localhostPorts);
            const kubernetesData = await this.fetchKubernetesData();

            for (const [key, value] of localhostData.entries()) {
                this.localhostData.set(key, value);
            }

            for (const [key, value] of kubernetesData.entries()) {
                this.kubernetesData.set(key, value);
            }

            console.log('Data initialized:', {
                localhost: this.localhostData,
                kubernetes: this.kubernetesData
            });

            this.loading = false; // Mark as no longer loading
            this.refresh(); // Refresh the UI with loaded data
        } catch (error) {
            console.error('Error initializing data:', error);
            this.loading = false; // Ensure loading is marked as false even on error
            this.refresh(); // Refresh UI to show the state
        }
    }

    private async fetchLocalhostRoutes(ports: [number, number]): Promise<Map<string, Route[]>> {
        const deployments: Map<string, Route[]> = new Map();
        const skippedPorts: number[] = [];

        // Generate the list of ports from the range
        const portRange = Array.from({ length: ports[1] - ports[0] + 1 }, (_, i) => ports[0] + i);

        const fetchPromises = portRange.map(async (port) => {
            try {
                const response = await fetch(`http://localhost:${port}/q/dev/route`, {
                    headers: { 'Accept': 'application/json' }
                });

                if (!response.ok) {
                    console.warn(`Port ${port} not available: ${response.statusText}`);
                    skippedPorts.push(port);
                    return; // Skip this port
                }

                const parsedFile = await response.json();
                console.log(`Data from port ${port}:`, parsedFile);

                if (parsedFile) {
                    for (const jsonRoute of parsedFile.route.routes) {
                        const route = new Route(
                            jsonRoute.routeId,
                            jsonRoute.source,
                            jsonRoute.from,
                            jsonRoute.remote,
                            jsonRoute.state,
                            jsonRoute.uptime,
                            jsonRoute.statistics
                        );

                        const fileNameKey = getBasenameIfAbsolute(route.associatedFile)
                        deployments.has(fileNameKey)
                            ? deployments.get(fileNameKey)?.push(route)
                            : deployments.set(fileNameKey, [route]);
                    }
                }
            } catch (error: any) {
                if (error.message.includes('fetch failed')) {
                    // Skip failed ports which are not used at all
                } else {
                    console.warn(`Port ${port}: Unknown error - ${error.message}`);
                }
                skippedPorts.push(port); // Track skipped ports
            }
        });

        await Promise.all(fetchPromises); // Wait for all fetches to complete

        // Notify user about skipped ports if any
        if (skippedPorts.length > 0) {
            console.log(`Some ports were unavailable: ${skippedPorts.join(', ')}`);
        }

        return deployments;
    }

    private getDisplayName(fileName: string): string {
        const match = fileName.match(/^(.+)\.camel\.yaml$/);
        return match ? match[1] : fileName; // Extract the part before ".camel.yaml" or return the full name
    }

    private startAutoRefresh(): void {
        this.intervalId = setInterval(async () => {
            try {
                console.log('Starting auto-refresh...');
                const newLocalhostData = await this.fetchLocalhostRoutes(this.localhostPorts);
                const newKubernetesData = await this.fetchKubernetesData();

                // Update the Localhost data cache
                for (const [key, value] of newLocalhostData.entries()) {
                    this.localhostData.set(key, value);
                }

                // Update the Kubernetes data cache
                for (const [key, value] of newKubernetesData.entries()) {
                    this.kubernetesData.set(key, value);
                }

                console.log('Updated Localhost Data:', this.localhostData);
                console.log('Updated Kubernetes Data:', this.kubernetesData);

                this.refresh(); // Refresh the UI after updating the caches
            } catch (error) {
                console.error('Error during auto-refresh:', error);
            }
        }, this.interval);
    }

}

// TreeItem classes remain the same
export class RootItem extends TreeItem {
    constructor(
        public readonly label: string,
        public readonly icon: string,
        public readonly expanded: TreeItemCollapsibleState,
        public readonly contextValue: string
    ) {
        super(label, expanded);
        this.iconPath = new ThemeIcon(this.icon);
    }
}

export class ParentItem extends TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly description?: string
    ) {
        super(label, collapsibleState);
        this.iconPath = ThemeIcon.File;
        this.description = description;
    }
}

export class ChildItem extends TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly integrationName: string,
        public readonly route?: Route
    ) {
        super(label, collapsibleState);

        if (route) {
            const { icon, context } = this.getRouteDetails(route.state || '');
            this.iconPath = icon;
            this.contextValue = `${contextValue} ${context}`; // Base context + dynamic context
            this.description = route.state === 'Started' ? `${route.state} (${route.uptime})` : route.state;
            this.tooltip = `${route.statistics.exchangesTotal} Total - ${route.statistics.exchangesFailed} Fail - ${route.statistics.exchangesInflight} Inflight`;
        }
    }

    private getRouteDetails(state: string): { icon: string; context: string } {
        const stateDetails: { [key: string]: { icon: string; context: string } } = {
            Started: {
                icon: join(__filename, '..', '..', '..', 'icons', 'deployments', 'route-started.png'),
                context: 'resumeDisabled suspendEnabled stopEnabled',
            },
            Suspended: {
                icon: join(__filename, '..', '..', '..', 'icons', 'deployments', 'route-suspended.png'),
                context: 'resumeEnabled suspendDisabled stopEnabled',
            },
            Stopped: {
                icon: join(__filename, '..', '..', '..', 'icons', 'deployments', 'route-stopped.png'),
                context: 'resumeEnabled suspendDisabled stopDisabled',
            },
            Default: {
                icon: join(__filename, '..', '..', '..', 'icons', 'deployments', 'route-default.png'),
                context: 'resumeDisabled suspendDisabled stopDisabled',
            },
        };
        return stateDetails[state] || stateDetails.Default;
    }
}

export class Route {

    associatedFile: string;

    constructor(
        public readonly routeId: string,
        public readonly source: string,
        public readonly from?: string,
        public readonly remote?: string,
        public readonly state?: string,
        public readonly uptime?: string,
        public readonly statistics?: any
    ) {
        this.associatedFile = source.split(':')[1];
    }
}
