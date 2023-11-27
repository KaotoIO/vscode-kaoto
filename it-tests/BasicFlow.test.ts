import { By, EditorView, until, VSBrowser, WebDriver, WebView } from 'vscode-extension-tester';
import { assert } from 'chai';
import * as path from 'path';
import { checkEmptyCanvasLoaded, openAndSwitchToKaotoFrame } from './Util';
import { waitUntil } from 'async-wait-until';
import * as fs from 'fs-extra';

const logging = require('selenium-webdriver/lib/logging');

describe('Kaoto basic development flow', function () {
  this.timeout(90_000);

  const workspaceFolder = path.join(__dirname, '../test Fixture with speci@l chars');

  let driver: WebDriver;
  let globalKaotoWebView: WebView;

  before(async function () {
    const logger = logging.getLogger('webdriver');
    logger.setLevel(logging.Level.DEBUG);
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
    if (globalKaotoWebView !== undefined) {
      try {
        await globalKaotoWebView.switchBack();
      } catch {
        // probably test not failed in Kaoto UI, just continue
      }
    }
    const editorView = new EditorView();
    await editorView.closeAllEditors();
  });

  it('Open "emptyPipe.kaoto.yaml" file and check Kaoto UI is loading', async function () {
    const { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(
      workspaceFolder,
      'emptyPipe.kaoto.yaml',
      driver,
      true
    );
    globalKaotoWebView = kaotoWebview;
    // Route name is not displayed with Kaoto next
    // await checkIntegrationNameInTopBarLoaded(driver, 'my-integration-name');
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
    globalKaotoWebView = kaotoWebview;
    await checkEmptyCanvasLoaded(driver);
    await createNewRoute(driver);
    await addActiveMQStep(driver);
    await checkStepWithTestIdPresent(driver, 'custom-node__activemq');

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
    globalKaotoWebView = kaotoWebview;
    await checkStepWithTestIdPresent(driver, 'custom-node__activemq');
    await kaotoWebview.switchBack();
  });

  it('Open Camel file and check Kaoto UI is loading', async function () {
    const { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(
      workspaceFolder,
      'my.camel.yaml',
      driver,
      true
    );
    globalKaotoWebView = kaotoWebview;
    await checkStepWithTestIdPresent(driver, 'custom-node__timer-*');
    await checkStepWithTestIdPresent(driver, 'custom-node__log-*');
    await kaotoWebview.switchBack();
    assert.isFalse(
      await kaotoEditor.isDirty(),
      'The Kaoto editor should not be dirty after everything has loaded.'
    );
  });
});

async function createNewRoute(driver: WebDriver) {
  await (await driver.findElement(By.xpath("//button[@data-testid='dsl-list-btn']"))).click();
}

async function addActiveMQStep(driver: WebDriver) {
  console.log('will add an activemq step');
  await driver.wait(
    until.elementLocated(By.className('pf-topology__node__action-icon'))
  );
  console.log('will click node action btn');
  await (await driver.findElement(By.className('pf-topology__node__action-icon'))).click();

  console.log('will wait for opened context menu');
  await driver.wait(
    until.elementLocated(By.className('pf-v5-c-dropdown pf-m-expanded'))
  );
  console.log('context menu opened, will click on insert');
  await (await driver.findElement(By.xpath("//li[@data-testid='context-menu-item-insert']"))).click();
  
  console.log('will click on the activemq tile');
  await driver.wait(
    until.elementLocated(By.xpath("//div[@data-testid='tile-activemq']"))
  );
  await (await driver.findElement(By.xpath("//div[@data-testid='tile-activemq']"))).click();
}

async function checkStepWithTestIdPresent(driver: WebDriver, testId: string) {
  console.log(`check step starts with testId = ${testId}`);
  console.log(`//g[starts-with(@data-testid, '${testId}')]`);
  await driver.wait(
    until.elementLocated(By.xpath(`//g[starts-with(@data-testid, '${testId}')]`)
  ));
}

async function checkIntegrationNameInTopBarLoaded(driver: WebDriver, name: string) {
  await driver.wait(until.elementLocated(By.xpath(`//span[text()='${name}']`)));
}
