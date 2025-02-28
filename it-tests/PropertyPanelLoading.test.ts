import { By, EditorView, until, VSBrowser, WebDriver, WebView } from 'vscode-extension-tester';
import * as path from 'path';
import { openAndSwitchToKaotoFrame } from './Util';

describe('Property panel loading test', function () {
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
		kaotoWebview = (await openAndSwitchToKaotoFrame(workspaceFolder, 'choice.camel.yaml', driver, true)).kaotoWebview;
		const stepWhenXpath = By.xpath(
			`//*[name()='g' and starts-with(@data-testid,'custom-node__when')]|//*[name()='foreignObject' and @data-nodelabel='when']/div/div`,
		);
		await driver.wait(until.elementLocated(stepWhenXpath), 5_000);
		await (await driver.findElement(stepWhenXpath)).click();
		await driver.wait(until.elementLocated(By.className('pf-v6-c-card')), 5_000);

		const closeBtn = await driver.findElement(By.xpath("//button[@data-testid='close-side-bar']"));
		await driver.wait(
			async () => {
				return (await closeBtn.isDisplayed()) && (await closeBtn.isEnabled());
			},
			5_000,
			'Close button is not displayed!',
		);

		// It seems that the close button might not react if clicked too fast after being displayed
		await driver.sleep(1_00);

		await closeBtn.click();

		await driver.sleep(1_000);

		try {
			await driver.wait(until.elementLocated(By.className('pf-v6-c-card')), 5_000);
			throw new Error('Property panel was not closed!');
		} catch (error) {
			if (error instanceof Error && error.name !== 'TimeoutError') {
				throw new Error(error.message);
			}
		}
	});
});
