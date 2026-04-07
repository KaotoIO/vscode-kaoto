import { expect } from 'chai';
import * as vscode from 'vscode';
import { CamelCatalogService, CatalogDefinition, CatalogSelection } from '../../services/CamelCatalogService';

suite('CamelCatalogService Test Suite', () => {
	let catalogService: CamelCatalogService;
	let context: vscode.ExtensionContext;

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
		catalogService = new CamelCatalogService(context);
		await catalogService.initialize();
	});

	test('should load catalogs from index.json', () => {
		const catalogs = catalogService.getCatalogs();
		expect(catalogs).to.be.an('array');
		expect(catalogs.length).to.be.greaterThan(0);
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

	test('should detect Maven projects', async () => {
		// Test with a known Maven project path
		const testFixturePath = vscode.Uri.file(context.extensionPath + '/test Fixture with speci@l chars/camel-maven-main-project');
		const isMaven = await CamelCatalogService.isMavenProject(testFixturePath);
		expect(isMaven).to.be.true;
	});

	test('should not detect non-Maven projects', async () => {
		// Test with a non-Maven project path
		const testFixturePath = vscode.Uri.file(context.extensionPath + '/test Fixture with speci@l chars/kaoto-view');
		const isMaven = await CamelCatalogService.isMavenProject(testFixturePath);
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

		const label = CamelCatalogService.buildDisplayLabel(catalog);
		expect(label).to.equal('Main 4.18.0');
	});

	test('should build display label from catalog selection', () => {
		const selection: CatalogSelection = {
			version: '4.18.0',
			runtime: 'camel-main',
		};

		const label = CamelCatalogService.buildDisplayLabelFromSelection(selection);
		expect(label).to.equal('Camel Main 4.18.0');
	});

	test('should build display label for Spring Boot selection', () => {
		const selection: CatalogSelection = {
			version: '4.8.0',
			runtime: 'spring-boot',
		};

		const label = CamelCatalogService.buildDisplayLabelFromSelection(selection);
		expect(label).to.equal('Spring Boot 4.8.0');
	});

	test('should build display label for Quarkus selection', () => {
		const selection: CatalogSelection = {
			version: '3.15.0',
			runtime: 'quarkus',
		};

		const label = CamelCatalogService.buildDisplayLabelFromSelection(selection);
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
});
