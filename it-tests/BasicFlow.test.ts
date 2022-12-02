import { By, CustomEditor, EditorView,  until,  VSBrowser, WebDriver, WebView } from 'vscode-extension-tester';
import { assert } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

describe('Kaoto basic development flow', function () {
	this.timeout(25000);

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

	it('Open "empty.kaoto.yaml" file, check Kaoto UI is loading, add 2 steps, save and reload', async function () {
		const template = path.join(workspaceFolder, 'empty.kaoto.yaml');
		const fileForTest = path.join(workspaceFolder, 'basicflow.kaoto.yaml');
		fs.cpSync(template, fileForTest);
		await VSBrowser.instance.openResources(fileForTest);
		var kaotoEditor = new CustomEditor();
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty when opening it.');
		const kaotoWebview = new WebView();
		await switchToKaotoUIFrame(driver, kaotoWebview);
		await checkPartOfTopBarLoaded(driver);
		await checkCanvasLoaded(driver);
		await kaotoWebview.switchBack();
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty after everything has loaded.');
		
		await switchToKaotoUIFrame(driver, kaotoWebview);

		const addAStepNode = await driver.findElement(By.xpath("//div[text()='ADD A STEP']"));
		await addAStepNode.click();
		// #right-resize-panel > div > div.pf-c-drawer__content.panelCustom > div > div > div > div.react-flow__renderer > div.react-flow__viewport.react-flow__container > div.react-flow__nodes > div.react-flow__node.react-flow__node-step.selected.selectable > div > div.stepNode__Icon.stepNode__clickable
		const timerSourceFromLeftPanel = await driver.wait(until.elementLocated(By.xpath("//span[text()='timer-source']")));
		
		await driver.actions().dragAndDrop(timerSourceFromLeftPanel, addAStepNode).perform();
		
		
		await (await driver.findElement(By.id('viz-step-slot'))).click();
		//#right-resize-panel > div > div.pf-c-drawer__content.panelCustom > div > div > div > div.react-flow__renderer > div.react-flow__viewport.react-flow__container > div.react-flow__nodes > div > div > button.stepNode__Add.plusButton.nodrag
		
		await (await driver.wait(until.elementLocated(By.xpath("//span[text()='log']")))).click();
		// #popover-pf-1669985552947jtlc7ridqp-body > section > div.pf-l-gallery.miniCatalog__gallery > button:nth-child(31) > div > div.pf-l-grid__item.pf-m-9-col
		
		await kaotoWebview.switchBack();
		
		assert.isTrue(await kaotoEditor.isDirty(), 'The Kaoto editor should be dirty after adding two steps.');
		await kaotoEditor.save();
		
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty after saving.');
		
		const editorView = new EditorView();
		await editorView.closeEditor(await kaotoEditor.getTitle());
		
		await VSBrowser.instance.openResources(fileForTest);
		kaotoEditor = new CustomEditor();
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty when re-opening it.');
		
		// TODO: check display of reloaded file
		await editorView.closeEditor(await kaotoEditor.getTitle());
		fs.rmSync(fileForTest);
	});

});

async function switchToKaotoUIFrame(driver: WebDriver, kaotoWebview: WebView) {
	await driver.wait(async () => {
		try {
			await kaotoWebview.switchToFrame();
			return true;
		} catch {
			return false;
		}
	});
}

async function checkCanvasLoaded(driver: WebDriver) {
	await driver.wait(until.elementLocated(By.xpath("//div[text()='ADD A STEP']")));
}

async function checkPartOfTopBarLoaded(driver: WebDriver) {
	await driver.wait(until.elementLocated(By.xpath("//span[text()='my-integration-name']")));
}
