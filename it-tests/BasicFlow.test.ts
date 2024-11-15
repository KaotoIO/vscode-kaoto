import { By, EditorView, until, VSBrowser, WebDriver, WebView, logging } from 'vscode-extension-tester';
import { assert } from 'chai';
import * as path from 'path';
import { checkEmptyCanvasLoaded, checkTopologyLoaded, openAndSwitchToKaotoFrame } from './Util';
import { waitUntil } from 'async-wait-until';
import * as fs from 'fs-extra';

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
    fs.copySync(
      path.join(workspaceFolder, 'emptyPipe.kaoto.yaml'),
      path.join(workspaceFolder, 'emptyPipe.pipe.yaml')
    );
    fs.copySync(
      path.join(workspaceFolder, 'emptyPipe.kaoto.yaml'),
      path.join(workspaceFolder, 'emptyPipe-pipe.yaml')
    );

    driver = VSBrowser.instance.driver;
  });

  after(function () {
    fs.rmSync(path.join(workspaceFolder, 'empty_copy.camel.yaml'));
    fs.rmSync(path.join(workspaceFolder, 'emptyPipe.pipe.yaml'));
    fs.rmSync(path.join(workspaceFolder, 'emptyPipe-pipe.yaml'));
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

  const pipeFiles = ['emptyPipe.kaoto.yaml', 'emptyPipe.pipe.yaml', 'emptyPipe-pipe.yaml'];

  pipeFiles.forEach(function (pipeFile) {
    it(`Open "${pipeFile}" file and check Kaoto UI is loading`, async function () {
      const { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(
        workspaceFolder,
        pipeFile,
        driver,
        true
      );
      globalKaotoWebView = kaotoWebview;
      await checkIntegrationNameInTopBarLoaded(driver, 'my-integration-name');
      await checkTopologyLoaded(driver);
      await kaotoWebview.switchBack();
      assert.isFalse(
        await kaotoEditor.isDirty(),
        'The Kaoto editor should not be dirty after everything has loaded.'
      );
    });
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
    await kaotoEditor.save();
    await waitUntil(async () => {
      return !(await kaotoEditor.isDirty());
    });

    const editorView = new EditorView();
    await editorView.closeAllEditors();

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
    await checkStepWithTestIdPresent(driver, 'custom-node__timer');
    await checkStepWithTestIdPresent(driver, 'custom-node__log');
    await kaotoWebview.switchBack();
    assert.isFalse(
      await kaotoEditor.isDirty(),
      'The Kaoto editor should not be dirty after everything has loaded.'
    );
  });

  it('Open Kamelet file and check Kaoto UI is loading', async function () {
    const { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(
      workspaceFolder,
      'my.kamelet.yaml',
      driver,
      true
    );
    globalKaotoWebView = kaotoWebview;
    await checkStepWithTestIdPresent(driver, 'custom-node__timer');
    await checkStepWithTestIdPresent(driver, 'custom-node__https');
    await checkStepWithTestIdPresent(driver, 'custom-node__kamelet:sink');
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
  await driver.wait(
    until.elementLocated(By.css('g[data-testid^="custom-node__timer"]'))
  );

  const canvasNode = await driver.findElement(By.css('g[data-testid^="custom-node__timer"]'));
  await driver.actions().contextClick(canvasNode).perform();

  await driver.wait(
    until.elementLocated(By.className('pf-v5-c-dropdown pf-m-expanded'))
  );
  await (await driver.findElement(By.xpath("//\*[@data-testid='context-menu-item-replace']"))).click();

  await driver.wait(
    until.elementLocated(By.xpath("//div[@data-testid='tile-activemq']"))
  );
  await (await driver.findElement(By.xpath("//div[@data-testid='tile-activemq']"))).click();
}

async function checkStepWithTestIdPresent(driver: WebDriver, testId: string) {
  await driver.wait(
    until.elementLocated(By.xpath(`//\*[name()='g' and starts-with(@data-testid,'${testId}')]`)
    ), 5_000);
}

async function checkIntegrationNameInTopBarLoaded(driver: WebDriver, name: string) {
  await driver.wait(
    until.elementLocated(By.xpath(`//span[@data-testid='flows-list-route-id' and contains(., '${name}')]`)
    ), 5_000, `Unable to locate integration name '${name} in top bar!'`);
}
