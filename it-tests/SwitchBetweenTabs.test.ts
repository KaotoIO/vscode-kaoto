import { By, EditorView, until, VSBrowser, WebDriver, WebView } from 'vscode-extension-tester';
import { openAndSwitchToKaotoFrame } from './Util';
import { join } from 'path';
import { expect } from 'chai';

describe('Switching between editor tabs', function () {
	this.timeout(90_000);

	const WORKSPACE_FOLDER = join(__dirname, '../test Fixture with speci@l chars');

	const locators = {
		EditorTabs: {
			tabsList: 'pf-v6-c-tabs__list',
			tabsItem: 'pf-v6-c-tabs__item',
			activeTabAttribute: 'aria-selected',
			tabLabelAttribute: 'aria-label',
			tabText: 'pf-v6-c-tabs__item-text',
			designTabLabel: 'Design canvas',
			beansTabLabel: 'Beans editor',
			dataMapperTabLabel: 'DataMapper',
		},
		DesignCanvas: {
			canvas: 'topology',
		},
		BeansEditor: {
			listView: 'metadata-editor-modal-list-view',
			detailsView: 'metadata-editor-modal-details-view',
		},
		DataMapper: {
			howTo: 'pf-v6-l-bullseye datamapper-howto',
		},
	};

	let driver: WebDriver;
	let kaotoWebview: WebView;

	before(function () {
		driver = VSBrowser.instance.driver;
	});

	after(async function () {
		await kaotoWebview.switchBack();
		await new EditorView().closeAllEditors();
	});

	it('Open "my.camel.yaml" file and check "Design" tab is active by default', async function () {
		kaotoWebview = (await openAndSwitchToKaotoFrame(WORKSPACE_FOLDER, 'my.camel.yaml', driver, true)).kaotoWebview;
		await driver.wait(until.elementLocated(By.className(locators.EditorTabs.tabsList)), 5_000, 'Editor tabs are not displayed properly!');
		expect(await getActiveTabName()).to.equal('Design');
	});

	it('Switch to "Beans" tab and check it is active', async function () {
		await switchToTab(locators.EditorTabs.beansTabLabel);
		await waitForBeansEditorIsLoaded();
		expect(await getActiveTabName()).to.equal('Beans');
	});

	it('Switch to "DataMapper" tab and check it is active', async function () {
		await switchToTab(locators.EditorTabs.dataMapperTabLabel);
		await waitForDataMapperIsLoaded();
		expect(await getActiveTabName()).to.equal('DataMapper');
	});

	it('Switch back to "Design" tab and check it is active', async function () {
		await switchToTab(locators.EditorTabs.designTabLabel);
		await waitForDesignCanvasIsLoaded();
		expect(await getActiveTabName()).to.equal('Design');
	});

	async function getActiveTabName(): Promise<string> {
		const tabName = await driver
			.findElement(By.className(locators.EditorTabs.tabsList))
			.findElement(By.xpath(`//button[@${locators.EditorTabs.activeTabAttribute}='true']`))
			.findElement(By.className(locators.EditorTabs.tabText));
		return await tabName.getText();
	}

	async function switchToTab(name: string): Promise<void> {
		await driver
			.findElement(By.className(locators.EditorTabs.tabsList))
			.findElement(By.xpath(`//button[@${locators.EditorTabs.tabLabelAttribute}='${name}']`))
			.click();
	}

	async function waitForDesignCanvasIsLoaded(): Promise<void> {
		await driver.wait(
			until.elementLocated(By.xpath(`//div[@data-test-id='${locators.DesignCanvas.canvas}']`)),
			5_000,
			'Design canvas of editor was not loaded properly!',
		);
	}

	async function waitForBeansEditorIsLoaded(): Promise<void> {
		await driver.wait(until.elementLocated(By.className(locators.BeansEditor.listView)), 5_000, 'Beans "list" view was not loaded properly!');
		await driver.wait(until.elementLocated(By.className(locators.BeansEditor.detailsView)), 5_000, 'Beans "details" view was not loaded properly!');
	}

	async function waitForDataMapperIsLoaded() {
		await driver.wait(until.elementLocated(By.className(locators.DataMapper.howTo)), 5_000, 'DataMapper "howTo" content was not loaded properly!');
	}
});
