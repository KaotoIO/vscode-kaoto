import { By, CustomEditor, EditorView,  until,  VSBrowser, WebDriver, WebView } from 'vscode-extension-tester';
import { assert } from 'chai';
import * as path from 'path';

describe('Kaoto basic development flow', function () {
	this.timeout(120000);

	const workspaceFolder = path.join(__dirname, '../test Fixture with speci@l chars');

	let driver: WebDriver;

	before(async function() {
		this.timeout(20000);
		driver = VSBrowser.instance.driver;
		await VSBrowser.instance.openResources(workspaceFolder);
	});

	after(async function() {
		const editorView = new EditorView();
		await editorView.closeAllEditors();
	});

	it('Open "empty.kaoto.yaml" file and check Kaoto UI is loading', async function () {
		this.timeout(60000);
		await VSBrowser.instance.openResources(path.join(workspaceFolder, 'empty.kaoto.yaml'));
		const kaotoEditor = new CustomEditor();
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty when opening it.');
		const kaotoWebview = new WebView();
		await driver.wait(async () => {
			try {
				await kaotoWebview.switchToFrame();
				return true;
			} catch {
				return false;
			}
		}, 50000); // if it is the first load, it can take a lot of time as it downloads the docker image
		await checkPartOfTopBarLoaded(driver);
		await checkCanvasLoaded(driver);
		await kaotoWebview.switchBack();
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty after everything has loaded.');
	});

});

async function checkCanvasLoaded(driver: WebDriver) {
	await driver.wait(until.elementLocated(By.xpath("//div[text()='ADD A STEP']")));
}

async function checkPartOfTopBarLoaded(driver: WebDriver) {
	await driver.wait(until.elementLocated(By.xpath("//span[text()='my-integration-name']")));
}
