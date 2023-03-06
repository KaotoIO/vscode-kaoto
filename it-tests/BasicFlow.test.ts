import { By, EditorView,  until,  VSBrowser, WebDriver } from 'vscode-extension-tester';
import { assert } from 'chai';
import * as path from 'path';
import { openAndSwitchToKaotoFrame } from './Util';
import { waitUntil } from 'async-wait-until';

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

	it('Open "emptyKameletBinding.kaoto.yaml" file and check Kaoto UI is loading', async function () {
		const { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(workspaceFolder, 'emptyKameletBinding.kaoto.yaml', driver, true);
		await checkIntegrationNameInTopBarLoaded(driver, 'my-integration-name');
		await checkEmptyCanvasLoaded(driver);
		await kaotoWebview.switchBack();
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty after everything has loaded.');
	});

	it('Open "empty.camel.yaml" file, check Kaoto UI is loading, add a step and save', async function () {
		let { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(workspaceFolder, 'empty.camel.yaml', driver, false);
		await checkEmptyCanvasLoaded(driver);
		await addActiveMQStep(driver);
		await checkStepWithTestIdPresent(driver, 'viz-step-activemq');

		await kaotoWebview.switchBack();
		assert.isTrue(await kaotoEditor.isDirty(), 'The Kaoto editor should be dirty after adding a step.');
		await kaotoEditor.save();
		await waitUntil(async() => {
			return !(await kaotoEditor.isDirty());
		});

		const editorView = new EditorView();
		await editorView.closeAllEditors();

		({ kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(workspaceFolder, 'empty.camel.yaml', driver, true));
		await checkStepWithTestIdPresent(driver, 'viz-step-activemq');
		await kaotoWebview.switchBack();
	});

	it('Open Camel file and check Kaoto UI is loading', async function () {
		const { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(workspaceFolder, 'my.camel.yaml', driver, true);
		await checkStepWithTestIdPresent(driver, 'viz-step-timer');
		await checkStepWithTestIdPresent(driver, 'viz-step-log');
		await kaotoWebview.switchBack();
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty after everything has loaded.');
	});
});

async function addActiveMQStep(driver: WebDriver) {
	await waitUntil(async () => {
		try {
			await clickOnAddAStep(driver);
		} catch {
			console.log('Clicked on step failed surely due to Kaoto UI redrawing the content of the canvas. Will retry as a workaround');
			return false;
		}
		return true;
	}, 5000, 500);
	await driver.wait(until.elementLocated(By.xpath("//button[@data-testid='miniCatalog__stepItem--activemq']")));
	await (await driver.findElement(By.xpath("//button[@data-testid='miniCatalog__stepItem--activemq']"))).click();
}

async function clickOnAddAStep(driver: WebDriver) {
	await (await driver.findElement(By.xpath("//div[@data-testid='viz-step-slot']"))).click();
}

async function checkStepWithTestIdPresent(driver: WebDriver, testId: string) {
	await driver.wait(until.elementLocated(By.xpath(`//div[@data-testid='${testId}']`)));
}

async function checkEmptyCanvasLoaded(driver: WebDriver) {
	await driver.wait(until.elementLocated(By.xpath("//div[@data-testid='viz-step-slot']")));
}

async function checkIntegrationNameInTopBarLoaded(driver: WebDriver, name: string) {
	await driver.wait(until.elementLocated(By.xpath(`//span[text()='${name}']`)));
}
