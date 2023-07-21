import { By, EditorView, until, VSBrowser, WebDriver } from 'vscode-extension-tester';
import { assert } from 'chai';
import * as path from 'path';
import { checkEmptyCanvasLoaded, openAndSwitchToKaotoFrame } from './Util';
import { waitUntil } from 'async-wait-until';
import * as fs from 'fs-extra';

describe('Kaoto basic development flow', function () {
  this.timeout(90_000);

  const workspaceFolder = path.join(__dirname, '../test Fixture with speci@l chars');

  let driver: WebDriver;

  before(async function () {
    fs.copySync(
      path.join(workspaceFolder, 'empty.camel.yaml'),
      path.join(workspaceFolder, 'empty_copy.camel.yaml')
    );

    driver = VSBrowser.instance.driver;
  });

  after(function () {
    fs.rmSync(path.join(workspaceFolder, 'empty_copy.camel.yaml'));
  });

  afterEach(async function () {
    const editorView = new EditorView();
    await editorView.closeAllEditors();
  });

  it('Open "emptyKameletBinding.kaoto.yaml" file and check Kaoto UI is loading', async function () {
    const { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(
      workspaceFolder,
      'emptyKameletBinding.kaoto.yaml',
      driver,
      true
    );
    await checkIntegrationNameInTopBarLoaded(driver, 'my-integration-name');
    await checkEmptyCanvasLoaded(driver);
    await kaotoWebview.switchBack();
    assert.isFalse(
      await kaotoEditor.isDirty(),
      'The Kaoto editor should not be dirty after everything has loaded.'
    );
  });

  it('Open "empty.camel.yaml" file, check Kaoto UI is loading, add a step and save', async function () {
    let { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(
      workspaceFolder,
      'empty_copy.camel.yaml',
      driver,
      false
    );
    await checkEmptyCanvasLoaded(driver);
    await addActiveMQStep(driver);
    await checkStepWithTestIdPresent(driver, 'viz-step-activemq');

    await kaotoWebview.switchBack();
    assert.isTrue(
      await kaotoEditor.isDirty(),
      'The Kaoto editor should be dirty after adding a step.'
    );
    console.log('will save');
    await kaotoEditor.save();
    await waitUntil(async () => {
      return !(await kaotoEditor.isDirty());
    });
    console.log('editor no more dirty');

    const editorView = new EditorView();
    await editorView.closeAllEditors();
    console.log('editors closed');

    ({ kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(
      workspaceFolder,
      'empty_copy.camel.yaml',
      driver,
      true
    ));
    await checkStepWithTestIdPresent(driver, 'viz-step-activemq');
    await kaotoWebview.switchBack();
  });

  it('Open Camel file and check Kaoto UI is loading', async function () {
    const { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(
      workspaceFolder,
      'my.camel.yaml',
      driver,
      true
    );
    await checkStepWithTestIdPresent(driver, 'viz-step-timer');
    await checkStepWithTestIdPresent(driver, 'viz-step-log');
    await kaotoWebview.switchBack();
    assert.isFalse(
      await kaotoEditor.isDirty(),
      'The Kaoto editor should not be dirty after everything has loaded.'
    );
  });
});

async function addActiveMQStep(driver: WebDriver) {
  await waitUntil(
    async () => {
      try {
        await clickOnAddAStep(driver);
      } catch {
        console.log(
          'Clicked on step failed surely due to Kaoto UI redrawing the content of the canvas. Will retry as a workaround'
        );
        return false;
      }
      return true;
    },
    10_000,
    2_000
  );
  await driver.wait(
    until.elementLocated(By.xpath("//button[@data-testid='miniCatalog__stepItem--activemq']"))
  );
  await (
    await driver.findElement(By.xpath("//button[@data-testid='miniCatalog__stepItem--activemq']"))
  ).click();
}

async function clickOnAddAStep(driver: WebDriver) {
  await (await driver.findElement(By.xpath("//div[@data-testid='viz-step-slot']"))).click();
}

async function checkStepWithTestIdPresent(driver: WebDriver, testId: string) {
  await driver.wait(until.elementLocated(By.xpath(`//div[@data-testid='${testId}']`)));
}

async function checkIntegrationNameInTopBarLoaded(driver: WebDriver, name: string) {
  await driver.wait(until.elementLocated(By.xpath(`//span[text()='${name}']`)));
}
