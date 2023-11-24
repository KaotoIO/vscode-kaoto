import { By, EditorView, until, VSBrowser, WebDriver } from 'vscode-extension-tester';
import * as path from 'path';
import { openAndSwitchToKaotoFrame } from './Util';

describe('property panel loading test', function () {
  this.timeout(60_000);

  const workspaceFolder = path.join(__dirname, '../test Fixture with speci@l chars');

  let driver: WebDriver;

  before(async function () {
    this.timeout(60_000);
    driver = VSBrowser.instance.driver;
  });

  afterEach(async function () {
    const editorView = new EditorView();
    await editorView.closeAllEditors();
  });

  it('Open "choice.camel.yaml" file and check property panel is loading', async function () {
    const { kaotoWebview, } = await openAndSwitchToKaotoFrame(
      workspaceFolder,
      'choice.camel.yaml',
      driver,
      true
    );
    const stepWhenXpath = By.xpath("//g[@data-testid='custom-node__when-*']");
    await driver.wait(until.elementLocated(stepWhenXpath));
    await (await driver.findElement(stepWhenXpath)).click();
    await driver.wait(
      until.elementLocated(By.xpath("//input[@value='${header.foo} == 1']"))
    );
    await kaotoWebview.switchBack();
  });
});
