import { expect } from 'chai';
import * as vscode from 'vscode';
import { KaotoCatalogService, CatalogDefinition, CatalogSelection } from '../../services/KaotoCatalogService';

suite('KaotoCatalogService Test Suite', () => {
	let catalogService: KaotoCatalogService;
	let context: vscode.ExtensionContext;
	let originalGetConfiguration: typeof vscode.workspace.getConfiguration;
	let originalShowWarningMessage: typeof vscode.window.showWarningMessage;
	let originalFetch: typeof globalThis.fetch;

	suiteSetup(async () => {
		// Get the extension context
		const extension = vscode.extensions.getExtension('redhat.vscode-kaoto');
		if (!extension) {
			throw new Error('Extension not found');
		}
		await extension.activate();
		context = extension.exports?.context || ({} as vscode.ExtensionContext);
	});

	setup(async () => {
		originalGetConfiguration = vscode.workspace.getConfiguration;
		originalShowWarningMessage = vscode.window.showWarningMessage;
		originalFetch = globalThis.fetch;
		catalogService = new KaotoCatalogService(context);
		await catalogService.initialize();
	});

	teardown(() => {
		Object.defineProperty(vscode.workspace, 'getConfiguration', {
			value: originalGetConfiguration,
			configurable: true,
		});
		Object.defineProperty(vscode.window, 'showWarningMessage', {
			value: originalShowWarningMessage,
			configurable: true,
		});
		Object.defineProperty(globalThis, 'fetch', {
			value: originalFetch,
			configurable: true,
		});
	});

	test('should load catalogs from index.json', () => {
		const catalogs = catalogService.getCatalogs();
		expect(catalogs).to.be.an('array');
		expect(catalogs.length).to.be.greaterThan(0);
	});

	test('should load catalogs from custom URL when kaoto.catalog.url is configured', async () => {
		const remoteCatalogs: CatalogDefinition[] = [
			{
				name: 'Camel Main 9.9.9',
				version: '9.9.9',
				runtime: 'Main',
				fileName: 'camel-main/9.9.9/index.json',
			},
		];

		Object.defineProperty(vscode.workspace, 'getConfiguration', {
			value: () =>
				({
					get: (key: string) => (key === 'catalog.url' ? 'https://example.com/catalog/index.json' : undefined),
				}) as vscode.WorkspaceConfiguration,
			configurable: true,
		});

		Object.defineProperty(globalThis, 'fetch', {
			value: async () =>
				({
					ok: true,
					json: async () => ({
						definitions: remoteCatalogs,
						version: 1,
						name: 'remote-catalog',
					}),
				}) as Response,
			configurable: true,
		});

		catalogService = new KaotoCatalogService(context);
		await catalogService.initialize();

		expect(catalogService.getCatalogs()).to.deep.equal(remoteCatalogs);
	});

	test('should fallback to local catalogs when custom URL fetch fails', async () => {
		const warningMessages: string[] = [];
		Object.defineProperty(vscode.window, 'showWarningMessage', {
			value: async (message: string) => {
				warningMessages.push(message);
				return undefined;
			},
			configurable: true,
		});

		Object.defineProperty(vscode.workspace, 'getConfiguration', {
			value: () =>
				({
					get: (key: string) => (key === 'catalog.url' ? 'https://example.com/catalog/index.json' : undefined),
				}) as vscode.WorkspaceConfiguration,
			configurable: true,
		});

		Object.defineProperty(globalThis, 'fetch', {
			value: async () => {
				throw new Error('network failure');
			},
			configurable: true,
		});

		catalogService = new KaotoCatalogService(context);
		await catalogService.initialize();

		expect(catalogService.getCatalogs().length).to.be.greaterThan(0);
		expect(warningMessages).to.have.lengthOf(1);
		expect(warningMessages[0]).to.include('kaoto.catalog.url');
		expect(warningMessages[0]).to.include('Falling back to local node_modules catalog');
	});

	test('should group catalogs by runtime', () => {
		const grouped = catalogService.getCatalogsByRuntime();
		expect(grouped).to.be.an('object');
		expect(grouped).to.have.property('Main');
		expect(grouped).to.have.property('Quarkus');
		expect(grouped).to.have.property('Spring Boot');
	});

	test('should return default catalog (latest Camel Main RedHat version)', () => {
		const defaultCatalog = catalogService.getDefaultCatalog();
		expect(defaultCatalog).to.not.be.undefined;
		expect(defaultCatalog?.runtime).to.equal('Main');

		// Should prioritize RedHat versions if available
		const allMainCatalogs = catalogService.getCatalogs().filter((c) => c.runtime === 'Main');
		const hasRedHatVersions = allMainCatalogs.some((c) => c.version.toLowerCase().includes('redhat'));

		if (hasRedHatVersions) {
			expect(defaultCatalog?.version.toLowerCase()).to.include('redhat');
		}
	});

	test('should return default Citrus catalog for test files', () => {
		const testFileUri = vscode.Uri.file('/path/to/test.citrus.yaml');
		const defaultCatalog = catalogService.getDefaultCatalog(testFileUri);

		// Should return a Citrus catalog for test files
		const citrusCatalogs = catalogService.getCatalogs().filter((c) => c.runtime.toLowerCase() === 'citrus');
		if (citrusCatalogs.length > 0) {
			expect(defaultCatalog).to.not.be.undefined;
			expect(defaultCatalog?.runtime.toLowerCase()).to.equal('citrus');

			// Should be the latest version
			const sorted = citrusCatalogs.sort((a, b) => {
				return b.version.localeCompare(a.version, undefined, { numeric: true });
			});
			expect(defaultCatalog?.version).to.equal(sorted[0].version);
		}
	});

	test('should detect Maven projects', async () => {
		// Test with a known Maven project path
		const testFixturePath = vscode.Uri.file(context.extensionPath + '/test Fixture with speci@l chars/camel-maven-main-project');
		const isMaven = await KaotoCatalogService.isMavenProject(testFixturePath);
		expect(isMaven).to.be.true;
	});

	test('should not detect non-Maven projects', async () => {
		// Test with a non-Maven project path
		const testFixturePath = vscode.Uri.file(context.extensionPath + '/test Fixture with speci@l chars/kaoto-view');
		const isMaven = await KaotoCatalogService.isMavenProject(testFixturePath);
		expect(isMaven).to.be.false;
	});

	test('should validate catalog definitions', () => {
		const catalogs = catalogService.getCatalogs();
		catalogs.forEach((catalog) => {
			expect(catalog).to.have.property('name');
			expect(catalog).to.have.property('version');
			expect(catalog).to.have.property('runtime');
			expect(catalog).to.have.property('fileName');
			expect(catalog.name).to.be.a('string');
			expect(catalog.version).to.be.a('string');
			expect(catalog.runtime).to.be.a('string');
			expect(catalog.fileName).to.be.a('string');
		});
	});

	test('should detect Kaoto integration files', () => {
		// Test .camel.yaml files
		expect(catalogService['isKaotoIntegrationFile'](vscode.Uri.file('/path/to/route.camel.yaml'))).to.be.true;
		expect(catalogService['isKaotoIntegrationFile'](vscode.Uri.file('/path/to/route.camel.yml'))).to.be.true;

		// Test .kamelet.yaml files
		expect(catalogService['isKaotoIntegrationFile'](vscode.Uri.file('/path/to/source.kamelet.yaml'))).to.be.true;
		expect(catalogService['isKaotoIntegrationFile'](vscode.Uri.file('/path/to/source.kamelet.yml'))).to.be.true;

		// Test .pipe.yaml files
		expect(catalogService['isKaotoIntegrationFile'](vscode.Uri.file('/path/to/integration.pipe.yaml'))).to.be.true;
		expect(catalogService['isKaotoIntegrationFile'](vscode.Uri.file('/path/to/integration-pipe.yaml'))).to.be.true;

		// Test .camel.xml files
		expect(catalogService['isKaotoIntegrationFile'](vscode.Uri.file('/path/to/route.camel.xml'))).to.be.true;

		// Test non-integration files
		expect(catalogService['isKaotoIntegrationFile'](vscode.Uri.file('/path/to/test.citrus.yaml'))).to.be.false;
		expect(catalogService['isKaotoIntegrationFile'](vscode.Uri.file('/path/to/random.yaml'))).to.be.false;
		expect(catalogService['isKaotoIntegrationFile'](vscode.Uri.file('/path/to/pom.xml'))).to.be.false;
	});

	test('should detect Citrus test files', () => {
		// Test .citrus.yaml files
		expect(catalogService['isKaotoCitrusTestFile'](vscode.Uri.file('/path/to/test.citrus.yaml'))).to.be.true;
		expect(catalogService['isKaotoCitrusTestFile'](vscode.Uri.file('/path/to/test.citrus.yml'))).to.be.true;

		// Test .citrus.test.yaml files
		expect(catalogService['isKaotoCitrusTestFile'](vscode.Uri.file('/path/to/test.citrus.test.yaml'))).to.be.true;
		expect(catalogService['isKaotoCitrusTestFile'](vscode.Uri.file('/path/to/test.citrus-test.yaml'))).to.be.true;

		// Test .citrus.it.yaml files
		expect(catalogService['isKaotoCitrusTestFile'](vscode.Uri.file('/path/to/test.citrus.it.yaml'))).to.be.true;
		expect(catalogService['isKaotoCitrusTestFile'](vscode.Uri.file('/path/to/test.citrus-it.yaml'))).to.be.true;

		// Test non-test files
		expect(catalogService['isKaotoCitrusTestFile'](vscode.Uri.file('/path/to/route.camel.yaml'))).to.be.false;
		expect(catalogService['isKaotoCitrusTestFile'](vscode.Uri.file('/path/to/random.yaml'))).to.be.false;
		expect(catalogService['isKaotoCitrusTestFile'](vscode.Uri.file('/path/to/pom.xml'))).to.be.false;
	});

	test('should detect any Kaoto file (integration or test)', () => {
		// Test integration files
		expect(catalogService['isKaotoFile'](vscode.Uri.file('/path/to/route.camel.yaml'))).to.be.true;
		expect(catalogService['isKaotoFile'](vscode.Uri.file('/path/to/source.kamelet.yaml'))).to.be.true;
		expect(catalogService['isKaotoFile'](vscode.Uri.file('/path/to/integration.pipe.yaml'))).to.be.true;

		// Test Citrus test files
		expect(catalogService['isKaotoFile'](vscode.Uri.file('/path/to/test.citrus.yaml'))).to.be.true;
		expect(catalogService['isKaotoFile'](vscode.Uri.file('/path/to/test.citrus.test.yaml'))).to.be.true;

		// Test non-Kaoto files
		expect(catalogService['isKaotoFile'](vscode.Uri.file('/path/to/random.yaml'))).to.be.false;
		expect(catalogService['isKaotoFile'](vscode.Uri.file('/path/to/pom.xml'))).to.be.false;
	});

	test('should have Main runtime catalogs', () => {
		const grouped = catalogService.getCatalogsByRuntime();
		const mainCatalogs = grouped['Main'];
		expect(mainCatalogs).to.be.an('array');
		expect(mainCatalogs.length).to.be.greaterThan(0);
	});

	test('should have Quarkus runtime catalogs', () => {
		const grouped = catalogService.getCatalogsByRuntime();
		const quarkusCatalogs = grouped['Quarkus'];
		expect(quarkusCatalogs).to.be.an('array');
		expect(quarkusCatalogs.length).to.be.greaterThan(0);
	});

	test('should have Spring Boot runtime catalogs', () => {
		const grouped = catalogService.getCatalogsByRuntime();
		const springBootCatalogs = grouped['Spring Boot'];
		expect(springBootCatalogs).to.be.an('array');
		expect(springBootCatalogs.length).to.be.greaterThan(0);
	});

	test('should build display label from catalog definition', () => {
		const catalog: CatalogDefinition = {
			name: 'Camel Main 4.18.0',
			version: '4.18.0',
			runtime: 'Main',
			fileName: 'camel-main/4.18.0/index-825a64c8dcfd946d5eb88a96e71f6589.json',
		};

		const label = KaotoCatalogService.buildDisplayLabel(catalog);
		expect(label).to.equal('Main 4.18.0');
	});

	test('should build display label from catalog selection', () => {
		const selection: CatalogSelection = {
			version: '4.18.0',
			runtime: 'camel-main',
		};

		const label = KaotoCatalogService.buildDisplayLabelFromSelection(selection);
		expect(label).to.equal('Camel Main 4.18.0');
	});

	test('should build display label for Spring Boot selection', () => {
		const selection: CatalogSelection = {
			version: '4.8.0',
			runtime: 'spring-boot',
		};

		const label = KaotoCatalogService.buildDisplayLabelFromSelection(selection);
		expect(label).to.equal('Spring Boot 4.8.0');
	});

	test('should build display label for Quarkus selection', () => {
		const selection: CatalogSelection = {
			version: '3.15.0',
			runtime: 'quarkus',
		};

		const label = KaotoCatalogService.buildDisplayLabelFromSelection(selection);
		expect(label).to.equal('Quarkus 3.15.0');
	});

	test('should get Camel version for CLI from catalog (Main)', () => {
		const catalog: CatalogDefinition = {
			name: 'Camel Main 4.18.0',
			version: '4.18.0',
			runtime: 'Main',
			fileName: 'camel-main/4.18.0/index-825a64c8dcfd946d5eb88a96e71f6589.json',
		};

		const camelVersion = catalogService.getCamelVersionForCLI(catalog);
		expect(camelVersion).to.equal('4.18.0');
	});

	test('should get Camel version for CLI from catalog (Quarkus with mapping)', () => {
		const catalog: CatalogDefinition = {
			name: 'Camel Quarkus 3.32.0',
			version: '3.32.0',
			runtime: 'Quarkus',
			fileName: 'camel-quarkus/3.32.0/index-xxx.json',
		};

		const camelVersion = catalogService.getCamelVersionForCLI(catalog);
		// Quarkus 3.32.0 should map to Camel 4.18.0 according to mapping file
		expect(camelVersion).to.equal('4.18.0');
	});

	test('should get Camel version for CLI from catalog (RedHat)', () => {
		const catalog: CatalogDefinition = {
			name: 'Camel Main 4.14.2.redhat-00019',
			version: '4.14.2.redhat-00019',
			runtime: 'Main',
			fileName: 'camel-main/4.14.2.redhat-00019/index-xxx.json',
		};

		const camelVersion = catalogService.getCamelVersionForCLI(catalog);
		expect(camelVersion).to.equal('4.14.2.redhat-00019');
	});

	test('should return undefined Camel version for undefined catalog', () => {
		const camelVersion = catalogService.getCamelVersionForCLI(undefined);
		expect(camelVersion).to.be.undefined;
	});

	test('should get runtime for CLI from catalog (Main)', () => {
		const catalog: CatalogDefinition = {
			name: 'Camel Main 4.18.0',
			version: '4.18.0',
			runtime: 'Main',
			fileName: 'camel-main/4.18.0/index-825a64c8dcfd946d5eb88a96e71f6589.json',
		};

		const runtime = catalogService.getRuntimeForCLI(catalog);
		expect(runtime).to.equal('camel-main');
	});

	test('should get runtime for CLI from catalog (Quarkus)', () => {
		const catalog: CatalogDefinition = {
			name: 'Camel Quarkus 3.32.0',
			version: '3.32.0',
			runtime: 'Quarkus',
			fileName: 'camel-quarkus/3.32.0/index-xxx.json',
		};

		const runtime = catalogService.getRuntimeForCLI(catalog);
		expect(runtime).to.equal('quarkus');
	});

	test('should get runtime for CLI from catalog (Spring Boot)', () => {
		const catalog: CatalogDefinition = {
			name: 'Camel Spring Boot 4.18.0',
			version: '4.18.0',
			runtime: 'Spring Boot',
			fileName: 'camel-springboot/4.18.0/index-xxx.json',
		};

		const runtime = catalogService.getRuntimeForCLI(catalog);
		expect(runtime).to.equal('spring-boot');
	});

	test('should return undefined runtime for undefined catalog', () => {
		const runtime = catalogService.getRuntimeForCLI(undefined);
		expect(runtime).to.be.undefined;
	});

	test('should get CLI parameters from catalog', () => {
		const catalog: CatalogDefinition = {
			name: 'Camel Main 4.18.0',
			version: '4.18.0',
			runtime: 'Main',
			fileName: 'camel-main/4.18.0/index-825a64c8dcfd946d5eb88a96e71f6589.json',
		};

		const params = catalogService.getCLIParameters(catalog);
		expect(params.camelVersion).to.equal('4.18.0');
		expect(params.runtime).to.equal('camel-main');
	});

	test('should return empty CLI parameters for undefined catalog', () => {
		const params = catalogService.getCLIParameters(undefined);
		expect(params.camelVersion).to.be.undefined;
		expect(params.runtime).to.be.undefined;
	});

	suite('Active Kaoto document resolution', () => {
		let originalActiveTextEditorDescriptor: PropertyDescriptor | undefined;
		let originalActiveTabDescriptor: PropertyDescriptor | undefined;

		setup(() => {
			originalActiveTextEditorDescriptor = Object.getOwnPropertyDescriptor(vscode.window, 'activeTextEditor');
			originalActiveTabDescriptor = Object.getOwnPropertyDescriptor(vscode.window.tabGroups.activeTabGroup, 'activeTab');

			Object.defineProperty(vscode.window, 'activeTextEditor', {
				configurable: true,
				get: () => undefined,
			});
			Object.defineProperty(vscode.window.tabGroups.activeTabGroup, 'activeTab', {
				configurable: true,
				get: () => undefined,
			});
		});

		teardown(() => {
			if (originalActiveTextEditorDescriptor) {
				Object.defineProperty(vscode.window, 'activeTextEditor', originalActiveTextEditorDescriptor);
			}
			if (originalActiveTabDescriptor) {
				Object.defineProperty(vscode.window.tabGroups.activeTabGroup, 'activeTab', originalActiveTabDescriptor);
			}
		});

		test('should prefer active Kaoto webview tab for Citrus test files', () => {
			const testFileUri = vscode.Uri.file('/path/to/test.citrus.yaml');

			Object.defineProperty(vscode.window.tabGroups.activeTabGroup, 'activeTab', {
				configurable: true,
				get: () =>
					({
						input: { uri: testFileUri },
					}) as vscode.Tab,
			});

			const activeUri = catalogService['getActiveKaotoDocumentUri']();
			expect(activeUri?.fsPath).to.equal(testFileUri.fsPath);
		});

		test('should fall back to active text editor when no Kaoto webview tab is active', () => {
			const integrationFileUri = vscode.Uri.file('/path/to/route.camel.yaml');

			Object.defineProperty(vscode.window, 'activeTextEditor', {
				configurable: true,
				get: () =>
					({
						document: { uri: integrationFileUri },
					}) as vscode.TextEditor,
			});

			const activeUri = catalogService['getActiveKaotoDocumentUri']();
			expect(activeUri?.fsPath).to.equal(integrationFileUri.fsPath);
		});
	});

	suite('Separate Integration and Test Catalog Storage', () => {
		test('should store integration and test catalogs separately', async () => {
			// Get an integration catalog (Main)
			const integrationCatalog = catalogService.getCatalogs().find((c) => c.runtime === 'Main');
			expect(integrationCatalog).to.not.be.undefined;

			// Get a test catalog (Citrus)
			const testCatalog = catalogService.getCatalogs().find((c) => c.runtime.toLowerCase() === 'citrus');

			if (integrationCatalog && testCatalog) {
				// Set integration catalog
				await catalogService.setSelectedIntegrationCatalog(integrationCatalog);

				// Set test catalog
				await catalogService.setSelectedTestCatalog(testCatalog);

				// Verify both are stored correctly
				const storedIntegration = await catalogService.getSelectedIntegrationCatalog();
				const storedTest = await catalogService.getSelectedTestCatalog();

				expect(storedIntegration?.version).to.equal(integrationCatalog.version);
				expect(storedTest?.version).to.equal(testCatalog.version);

				// Verify they are different
				expect(storedIntegration?.runtime).to.not.equal(storedTest?.runtime);
			}
		});

		test('should return integration catalog for integration file URI', async () => {
			const integrationFileUri = vscode.Uri.file('/path/to/route.camel.yaml');
			const catalog = await catalogService.getSelectedCatalog(integrationFileUri);

			// Should return integration catalog (not Citrus)
			if (catalog) {
				expect(catalog.runtime.toLowerCase()).to.not.equal('citrus');
			}
		});

		test('should return test catalog for test file URI', async () => {
			const testFileUri = vscode.Uri.file('/path/to/test.citrus.yaml');
			const catalog = await catalogService.getSelectedCatalog(testFileUri);

			// Should return test catalog (Citrus) if available
			const citrusCatalogs = catalogService.getCatalogs().filter((c) => c.runtime.toLowerCase() === 'citrus');
			if (citrusCatalogs.length > 0 && catalog) {
				expect(catalog.runtime.toLowerCase()).to.equal('citrus');
			}
		});

		test('should have separate default catalogs for integration and test', () => {
			const integrationDefault = catalogService.getDefaultIntegrationCatalog();
			const testDefault = catalogService.getDefaultTestCatalog();

			expect(integrationDefault).to.not.be.undefined;
			expect(integrationDefault?.runtime).to.equal('Main');

			// Test default may be undefined if no Citrus catalogs available
			const citrusCatalogs = catalogService.getCatalogs().filter((c) => c.runtime.toLowerCase() === 'citrus');
			if (citrusCatalogs.length > 0) {
				expect(testDefault).to.not.be.undefined;
				expect(testDefault?.runtime.toLowerCase()).to.equal('citrus');
			}
		});
	});
});
