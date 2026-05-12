import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { KaotoOutputChannel } from '../extension/KaotoOutputChannel';
import catalogVersionMapping from './catalog-version-mapping.json';

/**
 * Simplified catalog selection stored in settings for integration files (only essential data)
 */
export interface CatalogSelection {
	version: string;
	runtime: 'camel-main' | 'spring-boot' | 'quarkus';
}

/**
 * Simplified catalog selection stored in settings for test files (only essential data)
 */
export interface CitrusCatalogSelection {
	version: string;
	runtime: 'citrus';
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
 * Mapping entry for catalog version to Camel CLI version
 * This is a temporary static mapping that will be replaced by catalog-provided mapping in the future
 */
interface CatalogVersionMapping {
	catalogVersion: string;
	catalogRuntime: string;
	executorVersion: string;
	runtime: 'camel-main' | 'spring-boot' | 'quarkus';
	comment?: string;
}

/**
 * Structure of the catalog version mapping JSON file
 */
interface CatalogVersionMappingFile {
	mappings: CatalogVersionMapping[];
}

/**
 * Service for managing Kaoto catalog selection and operations (Camel and Citrus)
 */
export class KaotoCatalogService {
	private static instance: KaotoCatalogService;
	private catalogs: CatalogDefinition[] = [];
	private statusBarItem: vscode.StatusBarItem | undefined;
	private readonly catalogBasePath: string;
	private readonly catalogIndexPath: string;

	constructor(private readonly context: vscode.ExtensionContext) {
		// Path to the catalog directory in node_modules
		this.catalogBasePath = path.join(context.extensionPath, 'node_modules', '@kaoto', 'camel-catalog', 'dist', 'camel-catalog');
		this.catalogIndexPath = path.join(this.catalogBasePath, 'index.json');
		KaotoCatalogService.instance = this;
	}

	/**
	 * Get the singleton instance
	 */
	public static getInstance(): KaotoCatalogService {
		if (!KaotoCatalogService.instance) {
			throw new Error('KaotoCatalogService not initialized. Call initialize() first.');
		}
		return KaotoCatalogService.instance;
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
			KaotoOutputChannel.logError('Failed to initialize KaotoCatalogService', error);
			vscode.window.showErrorMessage('Failed to load Camel catalogs. Some features may not work correctly.');
		}
	}

	/**
	 * Load catalogs from custom URL when configured, otherwise from local index.json
	 */
	private getCustomCatalogUrl(): string | undefined {
		return vscode.workspace.getConfiguration('kaoto').get<string | null>('catalog.url')?.trim() || undefined;
	}

	private async loadCatalogs(): Promise<void> {
		const customCatalogUrl = this.getCustomCatalogUrl();

		if (customCatalogUrl) {
			try {
				const response = await fetch(customCatalogUrl);

				if (!response.ok) {
					throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
				}

				const catalogIndex = (await response.json()) as CatalogIndex;
				this.catalogs = catalogIndex.definitions || [];
				KaotoOutputChannel.logInfo(`Loaded catalog index from custom URL: ${customCatalogUrl}`);
				return;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				KaotoOutputChannel.logWarning(`Failed to load catalog index from custom URL ${customCatalogUrl}: ${errorMessage}`);
				void vscode.window.showWarningMessage(
					`Failed to fetch Kaoto catalog from setting "kaoto.catalog.url". Falling back to local node_modules catalog. ${errorMessage}`,
				);
			}
		}

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
	private normalizeRuntime(runtime: string): 'camel-main' | 'spring-boot' | 'quarkus' | 'citrus' {
		const normalized = runtime.toLowerCase().replaceAll(/\s+/g, '-');
		if (normalized.includes('citrus')) {
			return 'citrus';
		} else if (normalized.includes('spring')) {
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
		const runtimeDisplayMap: Record<CatalogSelection['runtime'], string> = {
			'camel-main': 'Camel Main',
			'spring-boot': 'Spring Boot',
			quarkus: 'Quarkus',
		};
		const runtimeDisplay = runtimeDisplayMap[selection.runtime] || selection.runtime;
		return `${runtimeDisplay} ${selection.version}`;
	}

	/**
	 * Convert CatalogDefinition to CatalogSelection or CitrusCatalogSelection
	 */
	private toSelection(catalog: CatalogDefinition): CatalogSelection | CitrusCatalogSelection {
		const runtime = this.normalizeRuntime(catalog.runtime);
		if (runtime === 'citrus') {
			return {
				version: catalog.version,
				runtime: 'citrus',
			};
		}
		return {
			version: catalog.version,
			runtime: runtime,
		};
	}

	/**
	 * Find catalog definition from selection (supports both integration and test catalogs)
	 */
	private findCatalogFromSelection(selection: CatalogSelection | CitrusCatalogSelection): CatalogDefinition | undefined {
		return this.catalogs.find((c) => c.version === selection.version && this.normalizeRuntime(c.runtime) === selection.runtime);
	}

	/**
	 * Get the selected catalog for a workspace, or default if none selected
	 * Automatically determines whether to use integration or test catalog based on file type
	 */
	public async getSelectedCatalog(resourceUri?: vscode.Uri): Promise<CatalogDefinition | undefined> {
		// Determine file type and delegate to appropriate method
		if (resourceUri && this.isKaotoCitrusTestFile(resourceUri)) {
			return this.getSelectedTestCatalog(resourceUri);
		} else {
			return this.getSelectedIntegrationCatalog(resourceUri);
		}
	}

	/**
	 * Get the selected integration catalog for a workspace, or default if none selected
	 */
	public async getSelectedIntegrationCatalog(resourceUri?: vscode.Uri): Promise<CatalogDefinition | undefined> {
		const config = vscode.workspace.getConfiguration('kaoto', resourceUri);
		const selection = config.get<CatalogSelection>('camelCatalog.version');

		if (selection) {
			const catalog = this.findCatalogFromSelection(selection);
			if (catalog) {
				return catalog;
			}
			// Warn user about invalid catalog selection
			KaotoOutputChannel.logWarning(
				`Invalid Camel catalog version in settings: ${selection.version} (${selection.runtime}). ` +
					`This version is not available in the catalog. Using default catalog instead. ` +
					`Use the status bar or command palette to select a valid version.`,
			);
			vscode.window
				.showWarningMessage(
					`Kaoto: Invalid catalog version "${selection.version}" (${selection.runtime}). Using default instead.`,
					'Select Valid Version',
				)
				.then((choice) => {
					if (choice === 'Select Valid Version') {
						vscode.commands.executeCommand('kaoto.selectCamelCatalog');
					}
				});
		}

		// Return default integration catalog
		return this.getDefaultIntegrationCatalog();
	}

	/**
	 * Get the selected test catalog for a workspace, or default if none selected
	 */
	public async getSelectedTestCatalog(resourceUri?: vscode.Uri): Promise<CatalogDefinition | undefined> {
		const config = vscode.workspace.getConfiguration('kaoto', resourceUri);
		const selection = config.get<CitrusCatalogSelection>('citrusCatalog.version');

		if (selection) {
			const catalog = this.findCatalogFromSelection(selection);
			if (catalog) {
				return catalog;
			}
			// Warn user about invalid catalog selection
			KaotoOutputChannel.logWarning(
				`Invalid Citrus catalog version in settings: ${selection.version} (${selection.runtime}). ` +
					`This version is not available in the catalog. Using default catalog instead. ` +
					`Use the status bar or command palette to select a valid version.`,
			);
			vscode.window
				.showWarningMessage(
					`Kaoto: Invalid Citrus catalog version "${selection.version}" (${selection.runtime}). Using default instead.`,
					'Select Valid Version',
				)
				.then((choice) => {
					if (choice === 'Select Valid Version') {
						vscode.commands.executeCommand('kaoto.selectCamelCatalog');
					}
				});
		}

		// Return default test catalog
		return this.getDefaultTestCatalog();
	}

	/**
	 * Set the selected catalog for a workspace
	 * Automatically determines whether to store as integration or test catalog based on catalog runtime
	 */
	public async setSelectedCatalog(catalog: CatalogDefinition, resourceUri?: vscode.Uri): Promise<void> {
		// Determine if this is a Citrus catalog
		const isCitrusCatalog = this.normalizeRuntime(catalog.runtime) === 'citrus';

		if (isCitrusCatalog) {
			await this.setSelectedTestCatalog(catalog, resourceUri);
		} else {
			await this.setSelectedIntegrationCatalog(catalog, resourceUri);
		}
	}

	/**
	 * Set the selected integration catalog for a workspace
	 */
	public async setSelectedIntegrationCatalog(catalog: CatalogDefinition, resourceUri?: vscode.Uri): Promise<void> {
		// Get the current catalog before making changes
		const previousCatalog = await this.getSelectedIntegrationCatalog(resourceUri);

		// Check if the catalog is actually changing
		const isCatalogChanging =
			previousCatalog?.version !== catalog.version || this.normalizeRuntime(previousCatalog.runtime) !== this.normalizeRuntime(catalog.runtime);

		const config = vscode.workspace.getConfiguration('kaoto', resourceUri);

		// Store simplified selection (only version and runtime)
		const selection = this.toSelection(catalog) as CatalogSelection;
		await config.update('camelCatalog.version', selection, vscode.ConfigurationTarget.Workspace);

		const displayLabel = KaotoCatalogService.buildDisplayLabel(catalog);
		KaotoOutputChannel.logInfo(`Selected integration catalog: ${displayLabel}`);

		// Update status bar immediately with the new catalog
		if (this.statusBarItem) {
			this.statusBarItem.text = `$(package) ${displayLabel}`;
			this.statusBarItem.show();
		}

		// Get the currently active Kaoto editor
		const activeKaotoUri = this.getActiveKaotoDocumentUri();
		const isActiveKaotoIntegration = activeKaotoUri && this.isKaotoIntegrationFile(activeKaotoUri);

		// Only show notification if catalog actually changed and there is an active Kaoto integration editor
		if (isCatalogChanging && isActiveKaotoIntegration) {
			const action = await vscode.window.showInformationMessage('Integration catalog version changed. Reopen editor to apply changes.', 'Reopen');

			if (action === 'Reopen') {
				await this.reopenCurrentEditor(activeKaotoUri);
			}
		}
	}

	/**
	 * Set the selected test catalog for a workspace
	 */
	public async setSelectedTestCatalog(catalog: CatalogDefinition, resourceUri?: vscode.Uri): Promise<void> {
		// Get the current catalog before making changes
		const previousCatalog = await this.getSelectedTestCatalog(resourceUri);

		// Check if the catalog is actually changing
		const isCatalogChanging =
			previousCatalog?.version !== catalog.version || this.normalizeRuntime(previousCatalog.runtime) !== this.normalizeRuntime(catalog.runtime);

		const config = vscode.workspace.getConfiguration('kaoto', resourceUri);

		// Store simplified selection (only version and runtime)
		const selection = this.toSelection(catalog) as CitrusCatalogSelection;
		await config.update('citrusCatalog.version', selection, vscode.ConfigurationTarget.Workspace);

		const displayLabel = KaotoCatalogService.buildDisplayLabel(catalog);
		KaotoOutputChannel.logInfo(`Selected test catalog: ${displayLabel}`);

		// Update status bar immediately with the new catalog
		if (this.statusBarItem) {
			this.statusBarItem.text = `$(package) ${displayLabel}`;
			this.statusBarItem.show();
		}

		// Get the currently active Kaoto editor
		const activeKaotoUri = this.getActiveKaotoDocumentUri();
		const isActiveKaotoTest = activeKaotoUri && this.isKaotoCitrusTestFile(activeKaotoUri);

		// Only show notification if catalog actually changed and there is an active Kaoto test editor
		if (isCatalogChanging && isActiveKaotoTest) {
			const action = await vscode.window.showInformationMessage('Test catalog version changed. Reopen editor to apply changes.', 'Reopen');

			if (action === 'Reopen') {
				await this.reopenCurrentEditor(activeKaotoUri);
			}
		}
	}

	/**
	 * Get the default catalog based on file type
	 * - For test files: latest Citrus catalog
	 * - For integration files: latest Camel Main RedHat version (or latest Main if no RedHat version available)
	 */
	public getDefaultCatalog(resourceUri?: vscode.Uri): CatalogDefinition | undefined {
		// Check if this is a Citrus test file
		const isCitrusTest = resourceUri ? this.isKaotoCitrusTestFile(resourceUri) : false;

		if (isCitrusTest) {
			return this.getDefaultTestCatalog();
		} else {
			return this.getDefaultIntegrationCatalog();
		}
	}

	/**
	 * Get the default integration catalog (latest Camel Main RedHat version, or latest Main if no RedHat version available)
	 */
	public getDefaultIntegrationCatalog(): CatalogDefinition | undefined {
		// Find all Main runtime catalogs
		const mainCatalogs = this.catalogs.filter((c) => c.runtime === 'Main');

		if (mainCatalogs.length === 0) {
			return this.catalogs[0]; // Fallback to first catalog
		}

		// Prioritize RedHat versions
		const redhatCatalogs = mainCatalogs.filter((c) => c.version.toLowerCase().includes('redhat'));

		if (redhatCatalogs.length > 0) {
			// Sort RedHat versions by version (descending) and return the latest
			const sorted = redhatCatalogs.toSorted((a, b) => {
				return b.version.localeCompare(a.version, undefined, { numeric: true });
			});
			return sorted[0];
		}

		// If no RedHat versions, fall back to latest Main version
		const sorted = mainCatalogs.toSorted((a, b) => {
			return b.version.localeCompare(a.version, undefined, { numeric: true });
		});

		return sorted[0];
	}

	/**
	 * Get the default test catalog (latest Citrus catalog)
	 */
	public getDefaultTestCatalog(): CatalogDefinition | undefined {
		const citrusCatalogs = this.catalogs.filter((c) => c.runtime.toLowerCase() === 'citrus');
		if (citrusCatalogs.length > 0) {
			const sorted = citrusCatalogs.toSorted((a, b) => {
				return b.version.localeCompare(a.version, undefined, { numeric: true });
			});
			return sorted[0];
		}
		return undefined;
	}
	/**
	 * Get the Camel version for CLI from catalog selection
	 * Uses the static mapping file to handle cases where catalog version != Camel version
	 * (e.g., Quarkus platform BOM versions, RedHat build number differences)
	 *
	 * @param catalog The catalog definition to get Camel version for
	 * @returns The Camel version to use with --camel-version parameter, or undefined if not found
	 */
	public getCamelVersionForCLI(catalog: CatalogDefinition | undefined): string | undefined {
		if (!catalog) {
			return undefined;
		}

		// Load mapping file
		const mappingData = catalogVersionMapping as CatalogVersionMappingFile;

		// Find matching mapping entry
		const mapping = mappingData.mappings.find((m) => m.catalogVersion === catalog.version && m.catalogRuntime === catalog.runtime);

		if (mapping) {
			return mapping.executorVersion;
		}

		// Fallback: use catalog version directly (may not work for all cases)
		KaotoOutputChannel.logWarning(
			`No mapping found for catalog ${catalog.version} (${catalog.runtime}), using catalog version as Camel version. ` +
				`Please update catalog-version-mapping.json if this is incorrect.`,
		);
		return catalog.version;
	}

	/**
	 * Get the runtime parameter for CLI from catalog selection
	 * Normalizes the runtime name to the format expected by Camel CLI
	 *
	 * @param catalog The catalog definition to get runtime for
	 * @returns The runtime to use with --runtime parameter, or undefined if not found
	 */
	public getRuntimeForCLI(catalog: CatalogDefinition | undefined): string | undefined {
		if (!catalog) {
			return undefined;
		}

		// Load mapping file
		const mappingData = catalogVersionMapping as CatalogVersionMappingFile;

		// Find matching mapping entry
		const mapping = mappingData.mappings.find((m) => m.catalogVersion === catalog.version && m.catalogRuntime === catalog.runtime);

		if (mapping) {
			return mapping.runtime;
		}

		// Fallback: use normalized runtime
		return this.normalizeRuntime(catalog.runtime);
	}

	/**
	 * Get both Camel version and runtime for CLI from catalog selection
	 * Convenience method that combines getCamelVersionForCLI and getRuntimeForCLI
	 *
	 * @param catalog The catalog definition to get CLI parameters for
	 * @returns Object with executorVersion and runtime, or empty object if catalog is undefined
	 */
	public getCLIParameters(catalog: CatalogDefinition | undefined): { executorVersion?: string; runtime?: string } {
		if (!catalog) {
			return {};
		}

		return {
			executorVersion: this.getCamelVersionForCLI(catalog),
			runtime: this.getRuntimeForCLI(catalog),
		};
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
			vscode.workspace.onDidChangeConfiguration((e) => {
				if (
					e.affectsConfiguration('kaoto.camelCatalog.version') ||
					e.affectsConfiguration('kaoto.citrusCatalog.version') ||
					e.affectsConfiguration('kaoto.catalog.url')
				) {
					void this.loadCatalogs();
					void this.updateStatusBar();
				}
			}),
			vscode.window.onDidChangeActiveTextEditor(() => {
				void this.updateStatusBar();
			}),
			vscode.window.tabGroups.onDidChangeTabGroups(() => {
				void this.updateStatusBar();
			}),
		);

		return this.statusBarItem;
	}

	/**
	 * Update the status bar item text and visibility
	 * Status bar is visible when:
	 * - A Kaoto editor is actively open/focused
	 * - The workspace is not a Maven project
	 */
	private async updateStatusBar(): Promise<void> {
		if (!this.statusBarItem) {
			return;
		}

		const documentUri = this.getActiveKaotoDocumentUri();

		// If no active Kaoto editor found, hide status bar
		if (!documentUri) {
			this.statusBarItem.hide();
			return;
		}

		// Check if Maven project
		const isMaven = await KaotoCatalogService.isMavenProject(documentUri);
		if (isMaven) {
			KaotoOutputChannel.logInfo('Status bar: Maven project detected, hiding status bar');
			this.statusBarItem.hide();
			return;
		}

		// Get selected catalog (or default if none selected) and update status bar
		const selectedCatalog = await this.getSelectedCatalog(documentUri);
		if (selectedCatalog) {
			const displayLabel = KaotoCatalogService.buildDisplayLabel(selectedCatalog);
			this.statusBarItem.text = `$(package) ${displayLabel}`;
			this.statusBarItem.tooltip = 'Select Camel Catalog Version';
			this.statusBarItem.command = 'kaoto.selectCamelCatalog';
			this.statusBarItem.show();
		} else {
			// If no catalog found (shouldn't happen), log warning but still show with default
			KaotoOutputChannel.logWarning('No catalog found for Kaoto file, using default');
			const defaultCatalog = this.getDefaultCatalog(documentUri);
			if (defaultCatalog) {
				const displayLabel = KaotoCatalogService.buildDisplayLabel(defaultCatalog);
				this.statusBarItem.text = `$(package) ${displayLabel}`;
				this.statusBarItem.tooltip = 'Select Camel Catalog Version';
				this.statusBarItem.command = 'kaoto.selectCamelCatalog';
				this.statusBarItem.show();
			} else {
				KaotoOutputChannel.logWarning('Status bar: No catalog available, hiding');
				this.statusBarItem.hide();
			}
		}
	}

	/**
	 * Get the active Kaoto document URI from either the focused webview tab or text editor
	 */
	private getActiveKaotoDocumentUri(): vscode.Uri | undefined {
		const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
		if (activeTab?.input && typeof activeTab.input === 'object' && activeTab.input !== null && 'uri' in activeTab.input) {
			const tabUri = (activeTab.input as { uri: vscode.Uri }).uri;
			if (this.isKaotoFile(tabUri)) {
				return tabUri;
			}
		}

		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor && this.isKaotoFile(activeEditor.document.uri)) {
			return activeEditor.document.uri;
		}

		return undefined;
	}

	/**
	 * Check if a file is a Kaoto-supported file (integration or test)
	 */
	private isKaotoFile(uri: vscode.Uri): boolean {
		return this.isKaotoIntegrationFile(uri) || this.isKaotoCitrusTestFile(uri);
	}

	/**
	 * Check if a file is a Kaoto integration file (camel, kamelet, pipe)
	 */
	private isKaotoIntegrationFile(uri: vscode.Uri): boolean {
		const fileName = path.basename(uri.fsPath);
		return /\.(camel|kamelet|pipe)\.(yaml|yml)$/.test(fileName) || /-pipe\.(yaml|yml)$/.test(fileName) || fileName.endsWith('.camel.xml');
	}

	/**
	 * Check if a file is a Kaoto Citrus test file
	 */
	private isKaotoCitrusTestFile(uri: vscode.Uri): boolean {
		const fileName = path.basename(uri.fsPath);
		return /\.citrus\.(yaml|yml)$/.test(fileName) || /\.citrus[.-](test|it)\.(yaml|yml)$/.test(fileName);
	}

	/**
	 * Show the catalog picker QuickPick
	 * @returns true if a catalog was selected, false if cancelled or no selection made
	 */
	public async showCatalogPicker(): Promise<boolean> {
		const resourceUri = this.getActiveKaotoDocumentUri();

		// Check if Maven project
		if (resourceUri && (await KaotoCatalogService.isMavenProject(resourceUri))) {
			vscode.window.showInformationMessage('Catalog version is managed by pom.xml in Maven projects.');
			return false;
		}

		if (this.getCustomCatalogUrl()) {
			await this.loadCatalogs();
		}

		// Determine if current file is a Citrus test file
		const isCitrusTestFile = resourceUri ? this.isKaotoCitrusTestFile(resourceUri) : false;

		const groupedCatalogs = this.getCatalogsByRuntime();
		const currentCatalog = await this.getSelectedCatalog(resourceUri);

		// Create QuickPick items grouped by runtime
		const items: CatalogQuickPickItem[] = [];

		for (const [runtime, catalogs] of Object.entries(groupedCatalogs)) {
			// Filter catalogs based on file type:
			// - For Citrus test files: show ONLY Citrus catalogs
			// - For integration files: show all catalogs EXCEPT Citrus
			const filteredCatalogs = catalogs.filter((catalog) => {
				const isCitrusCatalog = catalog.runtime.toLowerCase() === 'citrus';
				if (isCitrusTestFile) {
					// For test files, only show Citrus catalogs
					return isCitrusCatalog;
				} else {
					// For integration files, exclude Citrus catalogs
					return !isCitrusCatalog;
				}
			});

			// Skip runtime group if no catalogs after filtering
			if (filteredCatalogs.length === 0) {
				continue;
			}

			// Add runtime header
			items.push({
				label: runtime,
				kind: vscode.QuickPickItemKind.Separator,
			});

			// Add catalog items for this runtime
			for (const catalog of filteredCatalogs) {
				const displayLabel = KaotoCatalogService.buildDisplayLabel(catalog);
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
			placeHolder: isCitrusTestFile ? 'Select Citrus Catalog Version' : 'Select Camel Catalog Version',
			matchOnDescription: true,
			matchOnDetail: true,
		});

		if (selected?.catalog) {
			const catalog = selected.catalog;
			await this.setSelectedCatalog(catalog, resourceUri);
			return true; // Catalog was selected
		}

		return false; // No selection made (cancelled or closed)
	}

	/**
	 * Reopen the current editor (close and open again)
	 * This is used to apply catalog version changes to the active editor
	 */
	private async reopenCurrentEditor(uri: vscode.Uri): Promise<void> {
		try {
			// Close the current editor
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

			// Small delay to ensure the editor is fully closed
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Reopen the editor
			await vscode.commands.executeCommand('vscode.open', uri);

			KaotoOutputChannel.logInfo(`Reopened editor for ${uri.fsPath}`);
		} catch (error) {
			KaotoOutputChannel.logError(`Failed to reopen editor for ${uri.fsPath}`, error);
			vscode.window.showErrorMessage('Failed to reopen editor. Please close and reopen manually.');
		}
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		this.statusBarItem?.dispose();
	}
}
