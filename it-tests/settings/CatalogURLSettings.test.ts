/**
 * Copyright 2025 Red Hat, Inc. and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
	ActivityBar,
	after,
	before,
	By,
	EditorView,
	InputBox,
	Key,
	ModalDialog,
	NotificationType,
	StatusBar,
	TextSetting,
	until,
	VSBrowser,
	WebDriver,
	WebElement,
	WebView,
	Workbench,
} from 'vscode-extension-tester';
import { checkTopologyLoaded, closeEditor, openAndSwitchToKaotoFrame, resetUserSettings, switchToKaotoFrame } from '../Util';
import { join } from 'path';
import { rmSync } from 'fs';
import { expect } from 'chai';

describe('User Settings', function () {
	this.timeout(240_000);

	const WORKSPACE_FOLDER = join(__dirname, '../../test Fixture with speci@l chars');
	const CATALOG_URL = 'https://raw.githubusercontent.com/KaotoIO/camel-catalog/refs/heads/main/catalog/index.json';
	const CATALOG_SETTINGS_ID = 'kaoto.catalog.url';

	let driver: WebDriver;
	let kaotoWebview: WebView;

	const locators = {
		KaotoView: {
			catalogButton: By.xpath(`//button[@id='topology-control-bar-catalog-button']`),
			catalog: {
				window: By.xpath(`//div[@data-ouia-component-id='CatalogModal']`),
				list: By.className('pf-v6-c-data-list'),
				gallery: By.className('pf-v6-l-gallery pf-m-gutter'),
				listItem: By.className('pf-v6-c-data-list__item-row'),
				listItemProvider: By.className('catalog-data-list-item__provider'),
				listButton: By.xpath(`//button[@id='toggle-layout-button-List']`),
				galleryButton: By.xpath(`//button[@id='toggle-layout-button-Gallery']`),
				closeButton: By.xpath(`//button[@data-ouia-component-id='CatalogModal-ModalBoxCloseButton']`),
			},
			catalogProviderSelector: {
				dropdown: By.xpath(`//button[@data-testid='provider-filter-toggle']`),
				menu: By.id('providers-select-menu'),
				menuItem: By.className('pf-v6-c-menu__list-item'),
				selector: (label: string) => By.xpath(`//li[@data-testid='providers-select-item-${label}']`),
			},
		},
	};

	before(function () {
		driver = VSBrowser.instance.driver;
	});

	after(async function () {
		if (kaotoWebview !== undefined) {
			try {
				await kaotoWebview.switchBack();
			} catch {
				// probably test not failed in Kaoto UI, just continue
			}
		}
		try {
			await new EditorView().closeAllEditors();
		} catch {
			// handle modal dialog (e.g. "Save/Don't Save") that blocks editor close
			try {
				const dialog = new ModalDialog();
				await dialog.pushButton("Don't Save");
				await new EditorView().closeAllEditors();
			} catch {
				// if dialog handling also fails, use command palette as last resort
				await new Workbench().executeCommand('View: Close All Editors');
			}
		}
	});

	describe('Custom catalogs', function () {
		before(async function () {
			// provide the Catalog URL using Settings UI editor
			const settings = await new Workbench().openSettings();
			const textSetting = await driver.wait(
				async () => {
					return (await settings.findSetting('Url', 'Kaoto', 'Catalog')) as TextSetting;
				},
				5_000,
				'Looking for "Kaoto > Catalog: Url" text field.',
			);
			await textSetting.setValue(CATALOG_URL);
			await driver.sleep(1_000); // stabilize tests which are sometimes failing on macOS CI
			await closeEditor('Settings', true);

			await driver.wait(
				async () => {
					try {
						const viewControls = await new ActivityBar().getViewControls();
						return viewControls.length > 0;
					} catch {
						return false;
					}
				},
				5_000,
				'The activityBar is not reachable after 5 seconds. Maybe the modal dialog has not been successfully closed previously?',
			);
			// close sidebar
			await (await new ActivityBar().getViewControl('Explorer'))?.closeView();

			// open the integration file using Kaoto editor
			kaotoWebview = (await openAndSwitchToKaotoFrame(WORKSPACE_FOLDER, 'my.camel.yaml', driver, true)).kaotoWebview;
			await checkTopologyLoaded(driver);
		});

		after(async function () {
			if (kaotoWebview !== undefined) {
				try {
					await kaotoWebview.switchBack();
				} catch {
					// probably test not failed in Kaoto UI, just continue
				}
			}
			resetUserSettings(CATALOG_SETTINGS_ID);
			// the editor in this step needs to be closed using command palette
			// because in some cases, specially on Windows, there was hover displayed which was blocking the editor close button
			await new Workbench().executeCommand('View: Close Editor');
		});

		const runtimeSelectors = ['Main', 'Quarkus', 'Spring Boot'];

		it('Check custom Kaoto catalogs loaded for all runtimes', async function () {
			this.timeout(60_000);

			// switch back from Kaoto webview to interact with VS Code status bar
			await kaotoWebview.switchBack();
			await VSBrowser.instance.waitForWorkbench(5_000);

			// open catalog picker via status bar
			await clickCatalogStatusBarItem();
			const input = await InputBox.create(5_000);
			const picks = await input.getQuickPicks();

			const labels: string[] = [];
			for (const pick of picks) {
				labels.push(await pick.getLabel());
			}

			// verify catalogs for each runtime are present
			for (const runtime of runtimeSelectors) {
				const runtimeItems = labels.filter((label) => label.startsWith(`Camel ${runtime}`));
				expect(runtimeItems.length, `Expected catalog items for runtime '${runtime}'`).to.be.greaterThan(0);
				expect(runtimeItems).to.satisfy((items: string[]) => items.every((item) => item.startsWith(`Camel ${runtime}`)));
			}

			// close the quick pick without selecting
			await input.cancel();

			// switch back into webview frame
			await kaotoWebview.switchToFrame();
		});
	});

	describe('Default catalogs', function () {
		afterEach(async function () {
			try {
				await kaotoWebview.switchBack();
				await VSBrowser.instance.waitForWorkbench(5_000);
			} catch {
				// probably test not failed in Kaoto UI, just continue
			}
			await new EditorView().closeAllEditors();
		});

		after(async function () {
			rmSync(join(WORKSPACE_FOLDER, '.vscode'), { recursive: true, force: true });
		});

		beforeEach(async function () {
			kaotoWebview = (await openAndSwitchToKaotoFrame(WORKSPACE_FOLDER, 'my.camel.yaml', driver, true)).kaotoWebview;
			await checkTopologyLoaded(driver);
		});

		it(`Select 'community' catalog and check "Red Hat" components are not available`, async function () {
			this.timeout(90_000);

			// switch back from Kaoto webview to interact with VS Code status bar
			await kaotoWebview.switchBack();
			await VSBrowser.instance.waitForWorkbench(5_000);

			// open catalog picker via status bar and select a community 'Main' runtime catalog
			await clickCatalogStatusBarItem();
			const input = await InputBox.create(5_000);
			const picks = await input.getQuickPicks();

			// find and select the first 'Camel Main' item that is NOT a Red Hat version
			for (const pick of picks) {
				const label = await pick.getLabel();
				if (label.startsWith('Camel Main') && !label.toLowerCase().includes('redhat')) {
					await pick.select();
					break;
				}
			}

			// wait for the "Reopen" notification and click it
			await clickReopenNotification();

			// switch back to Kaoto webview frame after editor reload
			kaotoWebview = (await switchToKaotoFrame(driver, false)).kaotoWebview;
			await checkTopologyLoaded(driver, 15_000);

			const catalogWindow = await openCatalogInListView();

			const providers = await getCatalogProvidersList(catalogWindow);
			expect(providers).to.not.contain('Red Hat');
			expect(providers).to.contain('Community');

			// check first component does not contain 'Red Hat' flag
			const provider = await getFirstCatalogItemProvider(catalogWindow);
			expect(provider).to.not.be.equal('Red Hat');

			// switch catalog window back to gallery view
			await switchBackCatalogToGalleryViewAndClose(catalogWindow);
		});

		it(`Select 'redhat' catalog and check new components are available`, async function () {
			this.timeout(90_000);

			// switch back from Kaoto webview to interact with VS Code status bar
			await kaotoWebview.switchBack();
			await VSBrowser.instance.waitForWorkbench(5_000);

			// open catalog picker via status bar and select a Red Hat catalog
			await clickCatalogStatusBarItem();
			const input = await InputBox.create(5_000);
			const picks = await input.getQuickPicks();

			// find and select the first catalog with 'redhat' in the version
			for (const pick of picks) {
				const label = await pick.getLabel();
				if (label.toLowerCase().includes('redhat')) {
					await pick.select();
					break;
				}
			}

			// wait for the "Reopen" notification and click it
			await clickReopenNotification();

			// switch back to Kaoto webview frame after editor reload
			kaotoWebview = (await switchToKaotoFrame(driver, false)).kaotoWebview;
			await checkTopologyLoaded(driver, 15_000);

			const catalogWindow = await openCatalogInListView();

			const providers = await getCatalogProvidersList(catalogWindow);
			expect(providers).to.contain('Red Hat');
			expect(providers).to.contain('Community');

			await clickCatalogProviderCheckboxItem(catalogWindow, 'Community'); // uncheck 'Community' provider

			// check first component contains 'Red Hat' flag
			const provider = await getFirstCatalogItemProvider(catalogWindow);
			expect(provider).to.be.equal('Red Hat');

			// switch catalog window back to gallery view
			await switchBackCatalogToGalleryViewAndClose(catalogWindow);
		});
	});

	async function clickCatalogProviderDropdown(open: boolean, catalogWindow: WebElement) {
		const dropdown = await catalogWindow.findElement(locators.KaotoView.catalogProviderSelector.dropdown);
		await dropdown.click();
		await driver.sleep(1_000); // time to reflect changes in DOM

		if (open) {
			await driver.wait(until.elementLocated(locators.KaotoView.catalogProviderSelector.menu), 5_000);
		} else {
			try {
				await driver.wait(until.elementLocated(locators.KaotoView.catalogProviderSelector.menu), 5_000);
			} catch (error) {
				if (error instanceof Error && error.name !== 'TimeoutError') {
					throw new Error(error.message);
				}
			}
		}
	}

	async function clickCatalogProviderCheckboxItem(catalogWindow: WebElement, provider: string) {
		await clickCatalogProviderDropdown(true, catalogWindow); // open menu

		const menu = await catalogWindow.findElement(locators.KaotoView.catalogProviderSelector.menu);
		const item = await menu.findElement(locators.KaotoView.catalogProviderSelector.selector(provider));
		await item.click();

		await clickCatalogProviderDropdown(false, catalogWindow); // close menu
	}

	async function getCatalogProvidersList(catalogWindow: WebElement): Promise<string[]> {
		await clickCatalogProviderDropdown(true, catalogWindow); // open menu

		const menu = await catalogWindow.findElement(locators.KaotoView.catalogProviderSelector.menu);
		const items = await menu.findElements(locators.KaotoView.catalogProviderSelector.menuItem);
		const labels = await Promise.all(items.map(async (item) => await item.getText()));

		await clickCatalogProviderDropdown(false, catalogWindow); // close menu
		return labels;
	}

	async function getFirstCatalogItemProvider(catalogWindow: WebElement): Promise<string> {
		const listItem = await catalogWindow.findElement(locators.KaotoView.catalog.list).findElement(locators.KaotoView.catalog.listItem);
		const provider = await listItem.findElement(locators.KaotoView.catalog.listItemProvider).getText();
		return provider;
	}

	async function openCatalogInListView(): Promise<WebElement> {
		// wait for the catalog button to be visible and clickable
		const catalog = await driver.wait(until.elementLocated(locators.KaotoView.catalogButton), 10_000, 'Catalog button was not located');
		await driver.wait(until.elementIsVisible(catalog), 10_000, 'Catalog button was not visible');
		await driver.wait(until.elementIsEnabled(catalog), 10_000, 'Catalog button was not enabled');
		await catalog.click();

		// wait catalog modal dialog is open
		await driver.wait(until.elementLocated(locators.KaotoView.catalog.window), 15_000);
		const catalogWindow = await driver.findElement(locators.KaotoView.catalog.window);

		// switch to list view
		await catalogWindow.findElement(locators.KaotoView.catalog.listButton).click();
		await driver.wait(until.elementLocated(locators.KaotoView.catalog.list), 10_000);

		return catalogWindow;
	}

	async function switchBackCatalogToGalleryViewAndClose(catalogWindow: WebElement): Promise<void> {
		try {
			await catalogWindow.findElement(locators.KaotoView.catalog.galleryButton).click();
			await driver.wait(until.elementLocated(locators.KaotoView.catalog.gallery), 5_000);
		} catch (error) {
			// it can happen that because of hover text for list view button
			// the gallery view button is overlapped and it is not clickable at the moment
			await driver.actions().sendKeys(Key.ENTER).perform(); // WORKAROUND
			await catalogWindow.findElement(locators.KaotoView.catalog.galleryButton).click();
			await driver.wait(until.elementLocated(locators.KaotoView.catalog.gallery), 5_000);
		}

		// close catalog view
		await catalogWindow.findElement(locators.KaotoView.catalog.closeButton).click();
	}

	async function clickCatalogStatusBarItem(): Promise<void> {
		const statusBar = new StatusBar();
		const catalogItem = await driver.wait(
			async () => {
				const items = await statusBar.getItems();
				for (const item of items) {
					const text = await item.getText();
					if (text.includes('Camel')) {
						return item;
					}
				}
				return undefined;
			},
			10_000,
			'Catalog status bar item containing "Camel" was not found',
		);
		if (!catalogItem) {
			throw new Error('Catalog status bar item containing "Camel" was not found');
		}
		await catalogItem.click();
	}

	async function clickReopenNotification(): Promise<void> {
		await driver.wait(
			async () => {
				try {
					const notificationsCenter = await new Workbench().openNotificationsCenter();
					const notifications = await notificationsCenter.getNotifications(NotificationType.Info);
					for (const notification of notifications) {
						const message = await notification.getMessage();
						if (message.includes('Reopen editor to apply changes')) {
							await notification.takeAction('Reopen');
							return true;
						}
					}
					return false;
				} catch {
					return false;
				}
			},
			15_000,
			'Notification with "Reopen" button was not found after catalog change',
			1_000,
		);
		await driver.sleep(1_000); // allow editor to reopen
	}
});
