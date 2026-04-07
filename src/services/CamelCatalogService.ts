import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { KaotoOutputChannel } from '../extension/KaotoOutputChannel';

/**
 * Simplified catalog selection stored in settings (only essential data)
 */
export interface CatalogSelection {
	version: string;
	runtime: 'camel-main' | 'spring-boot' | 'quarkus';
}

/**
 * Full catalog definition from index.json
 */
export interface CatalogDefinition {
	name: string;
	version: string;
	runtime: string;
	fileName: string;
}

/**
 * Catalog index structure from index.json
 */
interface CatalogIndex {
	definitions: CatalogDefinition[];
	version: number;
	name: string;
}

/**
 * Grouped catalogs by runtime type
 */
interface GroupedCatalogs {
	[runtime: string]: CatalogDefinition[];
}

/**
 * Extended QuickPickItem with catalog data
 */
interface CatalogQuickPickItem extends vscode.QuickPickItem {
	catalog?: CatalogDefinition;
}

/**
 * Service for managing Camel catalog selection and operations
 */
export class CamelCatalogService {
	private static instance: CamelCatalogService;
	private catalogs: CatalogDefinition[] = [];
	private statusBarItem: vscode.StatusBarItem | undefined;
	private readonly catalogBasePath: string;
	private readonly catalogIndexPath: string;

	constructor(private readonly context: vscode.ExtensionContext) {
		// Path to the catalog directory in node_modules
		this.catalogBasePath = path.join(context.extensionPath, 'node_modules', '@kaoto', 'camel-catalog', 'dist', 'camel-catalog');
		this.catalogIndexPath = path.join(this.catalogBasePath, 'index.json');
		CamelCatalogService.instance = this;
	}

	/**
	 * Get the singleton instance
	 */
	public static getInstance(): CamelCatalogService {
		if (!CamelCatalogService.instance) {
			throw new Error('CamelCatalogService not initialized. Call initialize() first.');
		}
		return CamelCatalogService.instance;
	}

	/**
	 * Initialize the catalog service by loading available catalogs
	 */
	public async initialize(): Promise<void> {
		try {
			await this.loadCatalogs();
			KaotoOutputChannel.logInfo(`Loaded ${this.catalogs.length} Camel catalog definitions`);

			// Log default catalog
			const defaultCatalog = this.getDefaultCatalog();
			if (defaultCatalog) {
				KaotoOutputChannel.logInfo(`Default catalog: ${defaultCatalog.name}`);
			} else {
				KaotoOutputChannel.logWarning('No default catalog found');
			}
		} catch (error) {
			KaotoOutputChannel.logError('Failed to initialize CamelCatalogService', error);
			vscode.window.showErrorMessage('Failed to load Camel catalogs. Some features may not work correctly.');
		}
	}

	/**
	 * Load catalogs from the index.json file
	 */
	private async loadCatalogs(): Promise<void> {
		try {
			const indexContent = await fs.promises.readFile(this.catalogIndexPath, 'utf-8');
			const catalogIndex: CatalogIndex = JSON.parse(indexContent);
			this.catalogs = catalogIndex.definitions || [];
		} catch (error) {
			KaotoOutputChannel.logError(`Failed to load catalog index from ${this.catalogIndexPath}`, error);
			throw error;
		}
	}

	/**
	 * Get all available catalogs
	 */
	public getCatalogs(): CatalogDefinition[] {
		return [...this.catalogs];
	}

	/**
	 * Group catalogs by runtime type
	 */
	public getCatalogsByRuntime(): GroupedCatalogs {
		const grouped: GroupedCatalogs = {};

		for (const catalog of this.catalogs) {
			const runtime = catalog.runtime;
			if (!grouped[runtime]) {
				grouped[runtime] = [];
			}
			grouped[runtime].push(catalog);
		}

		return grouped;
	}

	/**
	 * Normalize runtime name from index.json to simplified format
	 */
	private normalizeRuntime(runtime: string): 'camel-main' | 'spring-boot' | 'quarkus' {
		const normalized = runtime.toLowerCase().replace(/\s+/g, '-');
		if (normalized.includes('spring')) {
			return 'spring-boot';
		} else if (normalized.includes('quarkus')) {
			return 'quarkus';
		}
		return 'camel-main';
	}

	/**
	 * Build display label from catalog definition
	 */
	public static buildDisplayLabel(catalog: CatalogDefinition): string {
		return `Camel ${catalog.runtime} ${catalog.version}`;
	}

	/**
	 * Build display label from catalog selection
	 */
	public static buildDisplayLabelFromSelection(selection: CatalogSelection): string {
		const runtimeDisplay = selection.runtime === 'camel-main' ? 'Camel Main' : selection.runtime === 'spring-boot' ? 'Spring Boot' : 'Quarkus';
		return `${runtimeDisplay} ${selection.version}`;
	}

	/**
	 * Convert CatalogDefinition to CatalogSelection
	 */
	private toSelection(catalog: CatalogDefinition): CatalogSelection {
		return {
			version: catalog.version,
			runtime: this.normalizeRuntime(catalog.runtime),
		};
	}

	/**
	 * Find catalog definition from selection
	 */
	private findCatalogFromSelection(selection: CatalogSelection): CatalogDefinition | undefined {
		return this.catalogs.find((c) => c.version === selection.version && this.normalizeRuntime(c.runtime) === selection.runtime);
	}

	/**
	 * Get the selected catalog for a workspace
	 */
	public async getSelectedCatalog(resourceUri?: vscode.Uri): Promise<CatalogDefinition | undefined> {
		const config = vscode.workspace.getConfiguration('kaoto', resourceUri);
		const selection = config.get<CatalogSelection>('camelCatalog.version');

		if (selection) {
			const catalog = this.findCatalogFromSelection(selection);
			if (catalog) {
				return catalog;
			}
		}

		// Return default catalog if no valid selection
		return this.getDefaultCatalog();
	}

	/**
	 * Set the selected catalog for a workspace
	 */
	public async setSelectedCatalog(catalog: CatalogDefinition, resourceUri?: vscode.Uri): Promise<void> {
		const config = vscode.workspace.getConfiguration('kaoto', resourceUri);

		// Store simplified selection (only version and runtime)
		const selection = this.toSelection(catalog);
		await config.update('camelCatalog.version', selection, vscode.ConfigurationTarget.Workspace);

		const displayLabel = CamelCatalogService.buildDisplayLabel(catalog);
		KaotoOutputChannel.logInfo(`Selected catalog: ${displayLabel}`);

		// Update status bar immediately with the new catalog
		if (this.statusBarItem) {
			this.statusBarItem.text = `$(package) ${displayLabel}`;
			this.statusBarItem.show();
		}

		// Check if there are any open Kaoto editors
		const kaotoEditors = vscode.window.visibleTextEditors.filter((editor) => this.isKaotoFile(editor.document.uri));

		// Only show notification if there are open Kaoto editors
		if (kaotoEditors.length > 0) {
			const action = await vscode.window.showInformationMessage('Catalog version changed. Reopen Kaoto editors to apply changes.', 'Reload Editors');

			if (action === 'Reload Editors') {
				await this.reloadKaotoEditors();
			}
		}
	}

	/**
	 * Get the default catalog (latest Camel Main RedHat version, or latest Main if no RedHat version available)
	 */
	public getDefaultCatalog(): CatalogDefinition | undefined {
		// Find all Main runtime catalogs
		const mainCatalogs = this.catalogs.filter((c) => c.runtime === 'Main');

		if (mainCatalogs.length === 0) {
			return this.catalogs[0]; // Fallback to first catalog
		}

		// Prioritize RedHat versions
		const redhatCatalogs = mainCatalogs.filter((c) => c.version.toLowerCase().includes('redhat'));

		if (redhatCatalogs.length > 0) {
			// Sort RedHat versions by version (descending) and return the latest
			const sorted = redhatCatalogs.sort((a, b) => {
				return b.version.localeCompare(a.version, undefined, { numeric: true });
			});
			return sorted[0];
		}

		// If no RedHat versions, fall back to latest Main version
		const sorted = mainCatalogs.sort((a, b) => {
			return b.version.localeCompare(a.version, undefined, { numeric: true });
		});

		return sorted[0];
	}

	/**
	 * Check if a workspace is a Maven project
	 */
	public static async isMavenProject(resourceUri: vscode.Uri): Promise<boolean> {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(resourceUri);
		if (!workspaceFolder) {
			return false;
		}

		const pomPath = path.join(workspaceFolder.uri.fsPath, 'pom.xml');
		try {
			await fs.promises.access(pomPath);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Validate if a catalog definition is valid
	 */
	private isValidCatalog(catalog: CatalogDefinition): boolean {
		return this.catalogs.some((c) => c.name === catalog.name && c.version === catalog.version && c.runtime === catalog.runtime);
	}

	/**
	 * Create and show the status bar item
	 */
	public createStatusBarItem(): vscode.StatusBarItem {
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

		this.statusBarItem.command = 'kaoto.selectCamelCatalog';
		this.statusBarItem.tooltip = 'Select Camel Catalog Version';

		// Don't show status bar initially - wait for Kaoto editor to be active
		KaotoOutputChannel.logInfo('Status bar created (hidden until Kaoto editor is active)');

		// Update status bar based on current editor
		void this.updateStatusBar();

		// Listen for workspace folder changes
		this.context.subscriptions.push(
			vscode.workspace.onDidChangeWorkspaceFolders(() => {
				void this.updateStatusBar();
			}),
		);

		// Listen for configuration changes
		this.context.subscriptions.push(
			vscode.workspace.onDidChangeConfiguration((e) => {
				if (e.affectsConfiguration('kaoto.camelCatalog.version')) {
					void this.updateStatusBar();
				}
			}),
		);

		// Listen for active editor changes to update status bar visibility
		this.context.subscriptions.push(
			vscode.window.onDidChangeActiveTextEditor(() => {
				void this.updateStatusBar();
			}),
		);

		// Listen for tab changes to detect custom editor (webview) activation
		this.context.subscriptions.push(
			vscode.window.tabGroups.onDidChangeTabGroups(() => {
				void this.updateStatusBar();
			}),
		);

		return this.statusBarItem;
	}

	/**
	 * Update the status bar item text and visibility
	 */
	private async updateStatusBar(): Promise<void> {
		if (!this.statusBarItem) {
			return;
		}

		// Check for active text editor first
		const activeEditor = vscode.window.activeTextEditor;
		let documentUri: vscode.Uri | undefined;

		if (activeEditor) {
			documentUri = activeEditor.document.uri;
		} else {
			// Check for active custom editor (webview) via tab groups
			const activeTab = vscode.window.tabGroups.activeTabGroup?.activeTab;
			if (activeTab && activeTab.input instanceof vscode.TabInputCustom) {
				documentUri = activeTab.input.uri;
			}
		}

		// If no active editor or tab, hide status bar
		if (!documentUri) {
			this.statusBarItem.hide();
			return;
		}

		// Check if current file is a Kaoto file
		const isKaotoFile = this.isKaotoFile(documentUri);
		if (!isKaotoFile) {
			// For non-Kaoto files, hide the status bar
			this.statusBarItem.hide();
			return;
		}

		// Check if Maven project
		const isMaven = await CamelCatalogService.isMavenProject(documentUri);
		if (isMaven) {
			this.statusBarItem.hide();
			return;
		}

		// Get selected catalog and update status bar
		const selectedCatalog = await this.getSelectedCatalog(documentUri);
		if (selectedCatalog) {
			const displayLabel = CamelCatalogService.buildDisplayLabel(selectedCatalog);
			this.statusBarItem.text = `$(package) ${displayLabel}`;
			this.statusBarItem.show();
		} else {
			this.statusBarItem.hide();
		}
	}

	/**
	 * Check if a file is a Kaoto-supported file
	 */
	private isKaotoFile(uri: vscode.Uri): boolean {
		const fileName = path.basename(uri.fsPath);
		return /\.(camel|kamelet|pipe)\.(yaml|yml)$/.test(fileName) || /-pipe\.(yaml|yml)$/.test(fileName) || /\.camel\.xml$/.test(fileName);
	}

	/**
	 * Show the catalog picker QuickPick
	 */
	public async showCatalogPicker(): Promise<void> {
		const activeEditor = vscode.window.activeTextEditor;
		const resourceUri = activeEditor?.document.uri;

		// Check if Maven project
		if (resourceUri && (await CamelCatalogService.isMavenProject(resourceUri))) {
			vscode.window.showInformationMessage('Catalog version is managed by pom.xml in Maven projects.');
			return;
		}

		const groupedCatalogs = this.getCatalogsByRuntime();
		const currentCatalog = await this.getSelectedCatalog(resourceUri);

		// Create QuickPick items grouped by runtime
		const items: CatalogQuickPickItem[] = [];

		for (const [runtime, catalogs] of Object.entries(groupedCatalogs)) {
			// Add runtime header
			items.push({
				label: runtime,
				kind: vscode.QuickPickItemKind.Separator,
			});

			// Add catalog items for this runtime
			for (const catalog of catalogs) {
				const displayLabel = CamelCatalogService.buildDisplayLabel(catalog);
				const isCurrent =
					currentCatalog?.version === catalog.version && this.normalizeRuntime(currentCatalog.runtime) === this.normalizeRuntime(catalog.runtime);
				items.push({
					label: isCurrent ? `$(check) ${displayLabel}` : displayLabel,
					detail: isCurrent ? 'Currently selected' : undefined,
					catalog: catalog,
				});
			}
		}

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select Camel Catalog Version',
			matchOnDescription: true,
			matchOnDetail: true,
		});

		if (selected && selected.catalog) {
			const catalog = selected.catalog;
			await this.setSelectedCatalog(catalog, resourceUri);
		}
	}

	/**
	 * Reload all open Kaoto editors
	 */
	private async reloadKaotoEditors(): Promise<void> {
		const kaotoEditors = vscode.window.visibleTextEditors.filter((editor) => this.isKaotoFile(editor.document.uri));

		for (const editor of kaotoEditors) {
			const uri = editor.document.uri;
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			await vscode.commands.executeCommand('vscode.open', uri);
		}
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		this.statusBarItem?.dispose();
	}
}
