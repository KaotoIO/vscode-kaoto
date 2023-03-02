import { assert } from 'chai';
import * as path from 'path';
import { CustomEditor, VSBrowser, WebDriver, WebView } from 'vscode-extension-tester';

export async function openAndSwitchToKaotoFrame(workspaceFolder: string, fileNameToOpen: string, driver: WebDriver) {
	await VSBrowser.instance.openResources(path.join(workspaceFolder, fileNameToOpen));
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
	return { kaotoWebview, kaotoEditor };
}
