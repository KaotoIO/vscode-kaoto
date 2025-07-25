import { By, EditorView, until, VSBrowser, WebDriver, WebView, logging, InputBox } from 'vscode-extension-tester';
import { assert } from 'chai';
import * as path from 'path';
import { checkEmptyCanvasLoaded, checkTopologyLoaded, openAndSwitchToKaotoFrame, openResourcesAndWaitForActivation } from './Util';
import { waitUntil } from 'async-wait-until';
import * as fs from 'fs-extra';

const DATA_TEST_ID_DATAMAPPERSTEP_2_5 = 'custom-node__route.from.steps.0.step:kaoto-datamapper';

describe('Kaoto basic development flow', function () {
	this.timeout(90_000);

	const workspaceFolder = path.join(__dirname, '../test Fixture with speci@l chars');

	let driver: WebDriver;
	let globalKaotoWebView: WebView;

	before(async function () {
		await openResourcesAndWaitForActivation(workspaceFolder);
		const logger = logging.getLogger('webdriver');
		logger.setLevel(logging.Level.DEBUG);
		fs.copySync(path.join(workspaceFolder, 'empty.camel.yaml'), path.join(workspaceFolder, 'empty_copy.camel.yaml'));
		fs.copySync(path.join(workspaceFolder, 'empty.camel.xml'), path.join(workspaceFolder, 'empty_copy.camel.xml'));
		fs.copySync(path.join(workspaceFolder, 'empty.camel.yaml'), path.join(workspaceFolder, 'for_datamapper_test.camel.yaml'));
		fs.copySync(path.join(workspaceFolder, 'emptyPipe_template.pipe.yaml'), path.join(workspaceFolder, 'emptyPipe.pipe.yaml'));
		fs.copySync(path.join(workspaceFolder, 'emptyPipe_template.pipe.yaml'), path.join(workspaceFolder, 'emptyPipe-pipe.yaml'));

		driver = VSBrowser.instance.driver;
	});

	after(function () {
		fs.rmSync(path.join(workspaceFolder, 'empty_copy.camel.yaml'));
		fs.rmSync(path.join(workspaceFolder, 'empty_copy.camel.xml'));
		fs.rmSync(path.join(workspaceFolder, 'for_datamapper_test.camel.yaml'));
		fs.rmSync(path.join(workspaceFolder, 'emptyPipe.pipe.yaml'));
		fs.rmSync(path.join(workspaceFolder, 'emptyPipe-pipe.yaml'));
	});

	afterEach(async function () {
		if (globalKaotoWebView !== undefined) {
			try {
				await globalKaotoWebView.switchBack();
			} catch {
				// probably test not failed in Kaoto UI, just continue
			}
		}
		const editorView = new EditorView();
		await editorView.closeAllEditors();
	});

	const pipeFiles = ['emptyPipe.pipe.yaml', 'emptyPipe-pipe.yaml'];

	pipeFiles.forEach(function (pipeFile) {
		it(`Open "${pipeFile}" file and check Kaoto UI is loading`, async function () {
			const { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(workspaceFolder, pipeFile, driver, true);
			globalKaotoWebView = kaotoWebview;
			await checkIntegrationNameInTopBarLoaded(driver, 'my-integration-name');
			await checkTopologyLoaded(driver);
			await kaotoWebview.switchBack();
			assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty after everything has loaded.');
		});
	});

	const routeFiles = ['empty_copy.camel.yaml', 'empty_copy.camel.xml'];

	routeFiles.forEach(function (routeFile) {
		it(`Open "${routeFile}" file, check Kaoto UI is loading, add a step and save`, async function () {
			let { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(workspaceFolder, routeFile, driver, false);
			globalKaotoWebView = kaotoWebview;
			await checkEmptyCanvasLoaded(driver);
			await createNewRoute(driver);
			await addAMQPStep(driver);
			await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__amqp', 'amqp');

			await kaotoWebview.switchBack();
			assert.isTrue(await kaotoEditor.isDirty(), 'The Kaoto editor should be dirty after adding a step.');
			await kaotoEditor.save();
			await waitUntil(async () => {
				return !(await kaotoEditor.isDirty());
			});

			const editorView = new EditorView();
			await editorView.closeAllEditors();

			({ kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(workspaceFolder, routeFile, driver, true));
			globalKaotoWebView = kaotoWebview;
			await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__amqp', 'amqp');
			await kaotoWebview.switchBack();
		});
	});

	it('Open empty file, add a datamapper step and save', async function () {
		let { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(workspaceFolder, 'for_datamapper_test.camel.yaml', driver, false);
		globalKaotoWebView = kaotoWebview;
		await checkEmptyCanvasLoaded(driver);
		await createNewRoute(driver);
		await addDatamapperStep(driver);
		await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__kaoto-datamapper', 'kaoto-datamapper');

		await openDataMapperEditor(driver);

		await addXsdForSource(driver, kaotoWebview);

		// TODO: Add a target xsd
		// TODO: Map an element

		await (await driver.findElement(By.css('a[data-testid="design-tab"]'))).click();

		const files = fs.readdirSync(workspaceFolder);
		const xslFiles = files.filter((file) => file.endsWith('.xsl'));
		assert.isTrue(xslFiles.length === 1, `Expected one xsl file created, found ${xslFiles.length}`);

		await deleteDataMapperStep(driver, workspaceFolder);

		await kaotoWebview.switchBack();
		assert.isTrue(await kaotoEditor.isDirty(), 'The Kaoto editor should be dirty after adding a DataMapper step.');
		await kaotoEditor.save();
		await waitUntil(async () => {
			return !(await kaotoEditor.isDirty());
		});

		const editorView = new EditorView();
		await editorView.closeAllEditors();
	});

	it('Open Camel file and check Kaoto UI is loading', async function () {
		const { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(workspaceFolder, 'my.camel.yaml', driver, true);
		globalKaotoWebView = kaotoWebview;
		await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__timer', 'timer');
		await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__log', 'log');
		await kaotoWebview.switchBack();
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty after everything has loaded.');
	});

	it('Open Kamelet file and check Kaoto UI is loading', async function () {
		const { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(workspaceFolder, 'my.kamelet.yaml', driver, true);
		globalKaotoWebView = kaotoWebview;
		await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__timer', 'timer');
		await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__https', 'https');
		await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__kamelet:sink', 'kamelet:sink');
		await kaotoWebview.switchBack();
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty after everything has loaded.');
	});
});

async function addXsdForSource(driver: WebDriver, kaotoWebview: WebView) {
	await driver.wait(
		until.elementLocated(By.css('button[data-testid="attach-schema-sourceBody-Body-button"]')),
		5000,
		'Cannot find the button to attach the schema',
	);
	await (await driver.findElement(By.css('button[data-testid="attach-schema-sourceBody-Body-button"]'))).click();

	await kaotoWebview.switchBack();
	const xsdInputbox = await InputBox.create(10000);
	await xsdInputbox.setText('shiporder.xsd');
	await xsdInputbox.confirm();
	await kaotoWebview.switchToFrame();

	await driver.wait(
		until.elementLocated(
			// Kaoto 2.6- using -field-, Kaoto 2.7+ using -fx-
			By.xpath('//div[starts-with(@data-testid, "node-source-field-shiporder-")] | //div[starts-with(@data-testid, "node-source-fx-shiporder-")]'),
		),
		5000,
		'Root of the imported xsd is not displayed in the UI',
	);
}

async function openDataMapperEditor(driver: WebDriver) {
	const kaotoNode = await driver.findElement(
		By.css(
			`g[data-testid^="custom-node__kaoto-datamapper"],g[data-testid="custom-node__route.from.steps.0.kaoto-datamapper"],g[data-testid="${DATA_TEST_ID_DATAMAPPERSTEP_2_5}"]`,
		),
	);
	await kaotoNode.click();
	await driver.wait(
		until.elementLocated(By.css('button[title="Click to launch the Kaoto DataMapper editor"]')),
		5000,
		'Cannot find the button to open the datamapper',
	);
	await (await driver.findElement(By.css('button[title="Click to launch the Kaoto DataMapper editor"]'))).click();
}

async function deleteDataMapperStep(driver: WebDriver, workspaceFolder: string) {
	await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__kaoto-datamapper', 'kaoto-datamapper');
	const kaotoNodeConfigured = await driver.findElement(
		By.css(
			`g[data-testid^="custom-node__kaoto-datamapper"],g[data-testid="custom-node__route.from.steps.0.kaoto-datamapper"],g[data-testid="${DATA_TEST_ID_DATAMAPPERSTEP_2_5}"]`,
		),
	);

	await driver.actions().contextClick(kaotoNodeConfigured).perform();

	await driver.wait(until.elementLocated(By.className('pf-topology-context-menu__c-dropdown__menu')));
	await (await driver.findElement(By.xpath("//*[@data-testid='context-menu-item-delete']"))).click();

	await (await driver.findElement(By.css('button[data-testid="action-confirmation-modal-btn-del-step-and-file"]'))).click();
	await waitUntil(() => {
		const filesAfterDeletion = fs.readdirSync(workspaceFolder);
		const xslFilesAfterDeletion = filesAfterDeletion.filter((file) => file.endsWith('.xsl'));
		return xslFilesAfterDeletion.length === 0;
	});
}

async function createNewRoute(driver: WebDriver) {
	await (await driver.findElement(By.xpath("//button[@data-testid='dsl-list-btn']"))).click();
}

async function addAMQPStep(driver: WebDriver) {
	await driver.wait(
		until.elementLocated(By.css('g[data-testid^="custom-node__timer"],g[data-testid="custom-node__route.from"]')),
		5000,
		'Cannot find the node for the timer',
	);

	const canvasNode = await driver.findElement(By.css('g[data-testid^="custom-node__timer"],g[data-testid="custom-node__route.from"]'));
	await driver.actions().contextClick(canvasNode).perform();

	await driver.wait(until.elementLocated(By.className('pf-topology-context-menu__c-dropdown__menu')));
	await (await driver.findElement(By.xpath("//\*[@data-testid='context-menu-item-replace']"))).click();

	await driver.wait(until.elementLocated(By.xpath("//div[@data-testid='tile-header-amqp']")));
	await (await driver.findElement(By.xpath("//div[@data-testid='tile-header-amqp']"))).click();
}

async function addDatamapperStep(driver: WebDriver) {
	await driver.wait(
		until.elementLocated(By.css('g[data-testid^="custom-node__log"],g[data-testid="custom-node__route.from.steps.0.log"]')),
		5000,
		'Cannot find the node for the log',
	);

	const canvasNode = await driver.findElement(By.css('g[data-testid^="custom-node__log"],g[data-testid="custom-node__route.from.steps.0.log"]'));
	await driver.actions().contextClick(canvasNode).perform();

	await driver.wait(until.elementLocated(By.className('pf-topology-context-menu__c-dropdown__menu')));
	await (await driver.findElement(By.xpath("//*[@data-testid='context-menu-item-replace']"))).click();

	await driver.wait(until.elementLocated(By.xpath("//input[@placeholder='Filter by name, description or tag']")));
	const filterInput = await driver.findElement(By.xpath("//input[@placeholder='Filter by name, description or tag']"));
	await filterInput.sendKeys('datamapper');
	await driver.wait(until.elementLocated(By.xpath("//div[@data-testid='tile-kaoto-datamapper']")));

	await (await driver.findElement(By.xpath("//div[@data-testid='tile-kaoto-datamapper']"))).click();
}

/**
 *
 * @param driver
 * @param testId used for Kaoto 2.3
 * @param nodeLabel used for Kaoto 2.4
 */
async function checkStepWithTestIdOrNodeLabelPresent(driver: WebDriver, testId: string, nodeLabel: string) {
	await driver.wait(until.elementLocated(By.xpath(`//*[name()='g' and starts-with(@data-testid,'${testId}') or @data-nodelabel='${nodeLabel}']`)), 5_000);
}

async function checkIntegrationNameInTopBarLoaded(driver: WebDriver, name: string) {
	await driver.wait(
		until.elementLocated(By.xpath(`//span[@data-testid='flows-list-route-id' and contains(., '${name}')]`)),
		5_000,
		`Unable to locate integration name '${name} in top bar!'`,
	);
}
