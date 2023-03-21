import { assert } from 'chai';
import * as path from 'path';
import { CustomEditor, VSBrowser, WebDriver, WebView } from 'vscode-extension-tester';

export async function openAndSwitchToKaotoFrame(workspaceFolder: string, fileNameToOpen: string, driver: WebDriver, checkNotDirty: boolean) {
	await VSBrowser.instance.openResources(path.join(workspaceFolder, fileNameToOpen));
	let kaotoEditor = new CustomEditor();
	if (checkNotDirty) {
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty when opening it.');
	}
	let kaotoWebview :WebView = await kaotoEditor.getWebView();
	await driver.wait(async () => {
		try {
			kaotoEditor = new CustomEditor();
			kaotoWebview = await kaotoEditor.getWebView();
			await kaotoWebview.switchToFrame();
			return true;
		} catch (exception){
			console.log('failed to switch to frame ' + exception);
			return false;
		}
	}, 20000, 'Failed to switch to frame',1000);
	return { kaotoWebview, kaotoEditor };
}
