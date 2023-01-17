import { Actions, By, CustomEditor, EditorView,  until,  VSBrowser, WebDriver, WebView } from 'vscode-extension-tester';
import { assert } from 'chai';
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

	it('Open "empty.kaoto.yaml" file and check Kaoto UI is loading', async function () {
		this.timeout(50000);
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
		});
		await checkPartOfTopBarLoaded(driver);
		await checkCanvasLoaded(driver);
		await kaotoWebview.switchBack();
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty after everything has loaded.');


		await kaotoWebview.switchToFrame();
		console.log('will search ')
		const stepNodeAddAStep = await driver.wait(until.elementLocated(By.xpath("//div[text()='ADD A STEP']")));
		console.log('found add a step');
		await stepNodeAddAStep.click();
		console.log('clicked');
		const componentSource = await driver.wait(until.elementLocated(By.xpath("//span[text()='aws-ddb-streams-source']")));
		console.log('found component source from palette');

		const rectTarget = await stepNodeAddAStep.getRect();
		const xTarget : number = Math.round(rectTarget.x + rectTarget.width/2);
		const yTarget : number = Math.round(rectTarget.y + rectTarget.height/2);

		// TODO: there si the drag but not the drop :-(
		await driver.actions({async: true})
			//.dragAndDrop(componentSource, stepNodeAddAStep)
			.dragAndDrop(componentSource, { x: xTarget, y: yTarget})
			.click(stepNodeAddAStep)
			.release()
			.perform();



		console.log('dropped');
		await driver.wait(until.elementLocated(By.xpath("//div[text()='aws-ddb-stream..']")));
		console.log('elemetn created');
		
		(await driver.wait(until.elementLocated(By.xpath("//button[@data-testid='stepNode__appendStep-btn']")))).click();
		
		await kaotoWebview.switchBack();
		assert.isTrue(await kaotoEditor.isDirty(), 'The Kaoto editor should be dirty after addign a step.');
		// TODO: close withotu saving
	});

});

async function checkCanvasLoaded(driver: WebDriver) {
	await driver.wait(until.elementLocated(By.xpath("//div[text()='ADD A STEP']")));
}

async function checkPartOfTopBarLoaded(driver: WebDriver) {
	await driver.wait(until.elementLocated(By.xpath("//span[text()='my-integration-name']")));
}
