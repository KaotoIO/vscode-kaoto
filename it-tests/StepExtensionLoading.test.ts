import { By, EditorView,  until,  VSBrowser, WebDriver } from 'vscode-extension-tester';
import * as path from 'path';
import { openAndSwitchToKaotoFrame } from './Util';
import waitUntil from 'async-wait-until';

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
		const { kaotoWebview, kaotoEditor } = await openAndSwitchToKaotoFrame(workspaceFolder, 'choice.camel.yaml', driver, true);
		const stepChoiceXpath = By.xpath("//div[@data-testid='viz-step-choice']");
		await driver.wait(until.elementLocated(stepChoiceXpath));

		await waitUntil(async () => {
			try {
				await (await driver.findElement(stepChoiceXpath)).click();
			} catch {
				console.log('Clicked on step failed surely due to Kaoto UI redrawing the content of the canvas. Will retry as a workaround');
				return false;
			}
			return true;
		}, 10000, 2000);

		await driver.wait(until.elementLocated(By.xpath("//button[@data-testid='choice-add-when-button']")));
		await kaotoWebview.switchBack();
	});

});
