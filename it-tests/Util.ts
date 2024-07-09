import { assert } from 'chai';
import * as path from 'path';
import * as fs from 'node:fs';
import * as os from 'os';
import { By, CustomEditor, EditorView, ModalDialog, TextEditor, until, VSBrowser, WebDriver, WebView } from 'vscode-extension-tester';

export async function openAndSwitchToKaotoFrame(
  workspaceFolder: string,
  fileNameToOpen: string,
  driver: WebDriver,
  checkNotDirty: boolean
) {
  await VSBrowser.instance.openResources(path.join(workspaceFolder, fileNameToOpen));
  return await switchToKaotoFrame(driver, checkNotDirty);
}

export async function switchToKaotoFrame(driver: WebDriver, checkNotDirty: boolean) {
  let kaotoEditor = new CustomEditor();
  if (checkNotDirty) {
    assert.isFalse(
      await kaotoEditor.isDirty(),
      'The Kaoto editor should not be dirty when opening it.'
    );
  }
  let kaotoWebview: WebView = kaotoEditor.getWebView();
  await driver.wait(
    async () => {
      try {
        kaotoEditor = new CustomEditor();
        kaotoWebview = kaotoEditor.getWebView();
        await kaotoWebview.switchToFrame();
        return true;
      } catch (exception) {
        console.log('failed to switch to frame ' + exception);
        return false;
      }
    },
    30000,
    'Failed to switch to frame',
    1000
  );
  return { kaotoWebview, kaotoEditor };
}

export async function checkEmptyCanvasLoaded(driver: WebDriver) {
  await driver.wait(until.elementLocated(By.xpath("//div[@data-testid='visualization-empty-state']")));
}

export async function checkTopologyLoaded(driver: WebDriver) {
  await driver.wait(until.elementLocated(By.xpath("//div[@data-test-id='topology']")));
}

// Enforce same default storage setup as ExTester - see https://github.com/redhat-developer/vscode-extension-tester/wiki/Test-Setup#useful-env-variables
export const storageFolder = process.env.TEST_RESOURCES ? process.env.TEST_RESOURCES : `${os.tmpdir()}/test-resources`;

/**
 * Reset user setting to default value by deleting item in settings.json.
 *
 * @param id ID of setting to reset.
 */
export function resetUserSettings(id: string): void {
	const settingsPath = path.resolve(storageFolder, 'settings', 'User', 'settings.json');
	const reset = fs.readFileSync(settingsPath, 'utf-8').replace(new RegExp(`"${id}.*`), '').replace(/,(?=[^,]*$)/, '');
	fs.writeFileSync(settingsPath, reset, 'utf-8');
}

/**
 * Close editor with handling of 'Save/Don't Save' Modal dialog.
 *
 * @param title Title of opened active editor.
 * @param save true/false
 */
export async function closeEditor(title: string, save?: boolean) {
	const dirty = await new TextEditor().isDirty();
	await new EditorView().closeEditor(title);
	if (dirty) {
		const dialog = new ModalDialog();
		if (save) {
			await dialog.pushButton('Save');
		} else {
			await dialog.pushButton('Don\'t Save');
		}
	}
}
