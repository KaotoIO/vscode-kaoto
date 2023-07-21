import { assert } from 'chai';
import * as path from 'path';
import { ActivityBar, By, CustomEditor, ExtensionsViewSection, until, ViewControl, VSBrowser, WebDriver, WebView } from 'vscode-extension-tester';

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
    40000,
    'Failed to switch to frame',
    1000
  );
  return { kaotoWebview, kaotoEditor };
}

export async function checkEmptyCanvasLoaded(driver: WebDriver) {
  await driver.wait(until.elementLocated(By.xpath("//div[@data-testid='viz-step-slot']")));
}

export async function getWebDriver(workspaceFolder?: string): Promise<WebDriver> {
  const driver = VSBrowser.instance.driver;

  if (workspaceFolder) {
    await VSBrowser.instance.openResources(workspaceFolder);
    await VSBrowser.instance.waitForWorkbench();

    // wait until extension is properly activated
    console.log('Waiting for extension is activated...');
    await waitUntilExtensionIsActivated(driver, 'Kaoto');
  }

  // Ugly workaround to wait that VS Code instance and its extensions have started before playing with it.
  // This is the first test to be played so putting this sleep only here.
  // See https://github.com/KaotoIO/vscode-kaoto/issues/202 to fix issue related to that
  await driver.sleep(5_000);

  return driver;
}

async function waitUntilExtensionIsActivated(driver: WebDriver, extension: string) {
  const viewControl = await new ActivityBar().getViewControl('Extensions') as ViewControl;
    const extensionsView = await viewControl.openView();
    await driver.wait(async function () {
      return (await extensionsView.getContent().getSections()).length > 0;
    }, 10_000, 'No extension was found in Extensions View!');
    await driver.wait(async function () {
      const item = await (await extensionsView.getContent().getSection('Installed') as ExtensionsViewSection).findItem(`@installed ${extension}`);
      const activationTime = await item?.findElement(By.className('activationTime'));
      return activationTime !== undefined;
    }, 60_000, 'Extension activation time not found!');
    await (await new ActivityBar().getViewControl('Explorer'))?.openView();
}
