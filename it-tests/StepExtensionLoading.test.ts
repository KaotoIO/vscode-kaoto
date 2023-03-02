import { By, EditorView,  until,  VSBrowser, WebDriver } from 'vscode-extension-tester';
import * as path from 'path';
import { openAndSwitchToKaotoFrame } from './Util';

describe('Step extension loading test', function () {
	this.timeout(25000);

	const workspaceFolder = path.join(__dirname, '../test Fixture with speci@l chars');

	let driver: WebDriver;

	before(async function() {
		this.timeout(20000);
		driver = VSBrowser.instance.driver;
		await VSBrowser.instance.openResources(workspaceFolder);
	});

	afterEach(async function() {
		const editorView = new EditorView();
		await editorView.closeAllEditors();
	});

	it('Open "choice.camel.yaml" file and check Step extension is loading', async function () {
		const { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(workspaceFolder, 'choice.camel.yaml', driver);
		const stepChoiceXpath = By.xpath("//div[@data-testid='viz-step-choice']");
		await driver.wait(until.elementLocated(stepChoiceXpath));
		await (await driver.findElement(stepChoiceXpath)).click();
		await driver.wait(until.elementLocated(By.xpath("//button[@data-testid='choice-add-when-button']")));
		await kaotoWebview.switchBack();
	});

});
