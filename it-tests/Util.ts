import { assert } from 'chai';
import * as path from 'path';
import { By, CustomEditor, until, VSBrowser, WebDriver, WebView } from 'vscode-extension-tester';

export async function openAndSwitchToKaotoFrame(workspaceFolder: string, fileNameToOpen: string, driver: WebDriver, checkNotDirty: boolean) {
	await VSBrowser.instance.openResources(path.join(workspaceFolder, fileNameToOpen));
	return await switchToKaotoFrame(driver, checkNotDirty);
}

export async function switchToKaotoFrame(driver: WebDriver, checkNotDirty: boolean) {
	const kaotoEditor = new CustomEditor();
	if (checkNotDirty) {
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty when opening it.');
	}
	const kaotoWebview = new WebView();
	await driver.wait(async () => {
		try {
			await kaotoWebview.switchToFrame();
			return true;
		} catch (exception) {
			console.log('failed to switch to frame ' + exception);
			return false;
		}
	}, 20000, 'Failed to switch to frame', 1000);
	return { kaotoWebview, kaotoEditor };
}

export async function checkEmptyCanvasLoaded(driver: WebDriver) {
	await driver.wait(until.elementLocated(By.xpath("//div[@data-testid='viz-step-slot']")));
}
