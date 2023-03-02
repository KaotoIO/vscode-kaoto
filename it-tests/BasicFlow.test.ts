import { By, EditorView,  until,  VSBrowser, WebDriver } from 'vscode-extension-tester';
import { assert } from 'chai';
import * as path from 'path';
import { openAndSwitchToKaotoFrame } from './Util';

describe('Kaoto basic development flow', function () {
	this.timeout(25000);

	const workspaceFolder = path.join(__dirname, '../test Fixture with speci@l chars');

	let driver: WebDriver;

	before(async function() {
		this.timeout(20000);
		driver = VSBrowser.instance.driver;
		await VSBrowser.instance.openResources(workspaceFolder);
	});

	afterEach(async function() {
		const editorView = new EditorView();
		await editorView.closeAllEditors();
	});

	it('Open "empty.kaoto.yaml" file and check Kaoto UI is loading', async function () {
		const { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(workspaceFolder, 'empty.kaoto.yaml', driver);
		await checkIntegrationNameInTopBarLoaded(driver, 'my-integration-name');
		await checkEmptyCanvasLoaded(driver);
		await kaotoWebview.switchBack();
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty after everything has loaded.');
	});

	it('Open Camel file and check Kaoto UI is loading', async function () {
		const { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(workspaceFolder, 'my.camel.yaml', driver);
		await driver.wait(until.elementLocated(By.xpath("//div[@data-testid='viz-step-timer']")));
		await driver.wait(until.elementLocated(By.xpath("//div[@data-testid='viz-step-log']")));
		await kaotoWebview.switchBack();
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty after everything has loaded.');
	});
});

async function checkEmptyCanvasLoaded(driver: WebDriver) {
	await driver.wait(until.elementLocated(By.xpath("//div[text()='ADD A STEP']")));
}

async function checkIntegrationNameInTopBarLoaded(driver: WebDriver, name: string) {
	await driver.wait(until.elementLocated(By.xpath(`//span[text()='${name}']`)));
}
