import { assert } from 'chai';
import * as path from 'path';
import { By, CustomEditor, until, VSBrowser, WebDriver, WebView } from 'vscode-extension-tester';

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
