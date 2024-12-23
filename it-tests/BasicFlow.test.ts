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
      path.join(workspaceFolder, 'empty.camel.yaml'),
      path.join(workspaceFolder, 'for_datamapper_test.camel.yaml')
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
    fs.rmSync(path.join(workspaceFolder, 'for_datamapper_test.camel.yaml'));
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
    await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__activemq', 'activemq');

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
    await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__activemq', 'activemq');
    await kaotoWebview.switchBack();
  });


  it('Open empty file, add a datamapper step and save', async function () {
    let { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(
      workspaceFolder,
      'for_datamapper_test.camel.yaml',
      driver,
      false
    );
    globalKaotoWebView = kaotoWebview;
    await checkEmptyCanvasLoaded(driver);
    await createNewRoute(driver);
    await addDatamapperStep(driver);
    await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__kaoto-datamapper', 'kaoto-datamapper');

    await kaotoWebview.switchBack();
    assert.isTrue(
      await kaotoEditor.isDirty(),
      'The Kaoto editor should be dirty after adding a DataMapper step.'
    );
    await kaotoEditor.save();
    await waitUntil(async () => {
      return !(await kaotoEditor.isDirty());
    });

    const editorView = new EditorView();
    await editorView.closeAllEditors();

    ({ kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(
      workspaceFolder,
      'for_datamapper_test.camel.yaml',
      driver,
      true
    ));
    globalKaotoWebView = kaotoWebview;
    await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__kaoto-datamapper', 'kaoto-datamapper');
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
    await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__timer', 'timer');
    await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__log', 'log');
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
    await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__timer', 'timer');
    await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__https', 'https');
    await checkStepWithTestIdOrNodeLabelPresent(driver, 'custom-node__kamelet:sink', 'kamelet:sink');
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
    until.elementLocated(By.css('g[data-testid^="custom-node__timer"],g[data-testid="custom-node__route.from"]'))
  , 5000, 'Cannot find the node for the timer');

  const canvasNode = await driver.findElement(By.css('g[data-testid^="custom-node__timer"],g[data-testid="custom-node__route.from"]'));
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

async function addDatamapperStep(driver: WebDriver) {
  await driver.wait(
    until.elementLocated(By.css('g[data-testid^="custom-node__log"],g[data-testid="custom-node__route.from.steps.0.log"]'))
  , 5000, 'Cannot find the node for the log');

  const canvasNode = await driver.findElement(By.css('g[data-testid^="custom-node__log"],g[data-testid="custom-node__route.from.steps.0.log"]'));
  await driver.actions().contextClick(canvasNode).perform();

  await driver.wait(
    until.elementLocated(By.className('pf-v5-c-dropdown pf-m-expanded'))
  );
  await (await driver.findElement(By.xpath("//*[@data-testid='context-menu-item-replace']"))).click();

  await driver.wait(
    until.elementLocated(By.xpath("//input[@placeholder='Filter by name, description or tag']"))
  );
  const filterInput = await driver.findElement(By.xpath("//input[@placeholder='Filter by name, description or tag']"));
  await filterInput.sendKeys('datamapper');
  await driver.wait(
    until.elementLocated(By.xpath("//div[@data-testid='tile-kaoto-datamapper']")
  ));

  await (await driver.findElement(By.xpath("//div[@data-testid='tile-kaoto-datamapper']"))).click();

  const kaotoNode = await driver.findElement(By.css('g[data-testid^="custom-node__kaoto-datamapper"],g[data-testid="custom-node__route.from.steps.0.kaoto-datamapper"]'));
  await kaotoNode.click();
}

/**
 * 
 * @param driver 
 * @param testId used for Kaoto 2.3
 * @param nodeLabel used for Kaoto 2.4
 */
async function checkStepWithTestIdOrNodeLabelPresent(driver: WebDriver, testId: string, nodeLabel: string) {
  await driver.wait(
    until.elementLocated(By.xpath(`//\*[name()='g' and starts-with(@data-testid,'${testId}') or @data-nodelabel='${nodeLabel}']`)
    ), 5_000);
}

async function checkIntegrationNameInTopBarLoaded(driver: WebDriver, name: string) {
  await driver.wait(
    until.elementLocated(By.xpath(`//span[@data-testid='flows-list-route-id' and contains(., '${name}')]`)
    ), 5_000, `Unable to locate integration name '${name} in top bar!'`);
}
