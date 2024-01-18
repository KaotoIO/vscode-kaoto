import { By, EditorView, until, VSBrowser, WebDriver, WebView } from 'vscode-extension-tester';
import * as path from 'path';
import { openAndSwitchToKaotoFrame } from './Util';

describe('property panel loading test', function () {
  this.timeout(60_000);

  const workspaceFolder = path.join(__dirname, '../test Fixture with speci@l chars');

  let driver: WebDriver;
  let kaotoWebview: WebView;

  before(async function () {
    this.timeout(60_000);
    driver = VSBrowser.instance.driver;
  });

  after(async function () {
    await kaotoWebview.switchBack();

    const editorView = new EditorView();
    await editorView.closeAllEditors();
  });

  it('Open "choice.camel.yaml" file and check property panel is loading and closing', async function () {
    console.log('### beggining');
    kaotoWebview = (await openAndSwitchToKaotoFrame(
      workspaceFolder,
      'choice.camel.yaml',
      driver,
      true
    )).kaotoWebview;
    console.log('### webview opened');
    const stepWhenXpath = By.xpath(`//\*[name()='g' and starts-with(@data-testid,'custom-node__when')]`)
    await driver.wait(until.elementLocated(stepWhenXpath), 5_000);
    console.log('### when step node found');
    await (await driver.findElement(stepWhenXpath)).click();
    await driver.wait(
      until.elementLocated(By.className('pf-v5-c-card')
    ), 5_000);
    console.log('### config panel opened');

    await (await driver.findElement(By.xpath("//button[@data-testid='close-side-bar']"))).click();
    try {
      await driver.wait(
        until.elementLocated(By.className('pf-v5-c-card')
      ), 5_000);
      throw new Error('Property panel was not closed!')
    } catch (error) {
      if(error.name !== 'TimeoutError') {
        throw new Error(error.message);
      }
    }
  });
});
