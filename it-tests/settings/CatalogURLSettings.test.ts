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
import { ActivityBar, after, By, Key, TextSetting, until, VSBrowser, WebDriver, WebElement, WebView, Workbench } from 'vscode-extension-tester';
import { checkTopologyLoaded, closeEditor, openAndSwitchToKaotoFrame, resetUserSettings } from '../Util';
import { join } from 'path';
import { expect } from 'chai';

describe('User Settings', function () {
	this.timeout(240_000);

	const WORKSPACE_FOLDER = join(__dirname, '../../test Fixture with speci@l chars');
	const CATALOG_URL = 'https://raw.githubusercontent.com/KaotoIO/camel-catalog/refs/heads/main/catalog/index.json';
	const CATALOG_SETTINGS_ID = 'kaoto.catalog.url';

	let driver: WebDriver;
	let kaotoWebview: WebView;

	const locators = {
		CatalogDropDown: {
			dropdown: By.xpath(`//button[@data-testid='runtime-selector-list-dropdown']`),
		},
		RuntimeSelector: {
			selector: (label: string) => By.xpath(`//li[@data-testid='runtime-selector-${label}']`),
		},
		RuntimeSelectorItems: {
			list: By.className('pf-v6-c-menu__list'),
			listItem: By.className('pf-v6-c-menu__list-item'),
			label: By.className('pf-v6-c-menu__item-text'),
			submenu: By.className('runtime-selector__submenu'),
		},
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
		},
	};

	before(async function () {
		this.timeout(60_000);
		driver = VSBrowser.instance.driver;

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

	runtimeSelectors.forEach(function (runtime) {
		it(`Check custom Kaoto catalog loaded - ${runtime}`, async function () {
			this.timeout(60_000);

			// expand Catalog dropdown
			const dropdown = await expandCatalogDropdown();

			// get all items available for selected runtime
			let items = await getDropdownItemsText(runtime);
			expect(items.length).is.greaterThan(1);
			expect(items).to.satisfy((items: string[]) => items.every((item) => item.startsWith(`Camel ${runtime}`)));

			// collapse catalog dropdown
			await dropdown.click();
			await driver.sleep(500); // time to reflect changes in DOM
			try {
				await driver.wait(until.elementLocated(locators.RuntimeSelectorItems.list), 5_000);
				throw new Error('Dropdown was not closed!');
			} catch (error) {
				if (error instanceof Error && error.name !== 'TimeoutError') {
					throw new Error(error.message);
				}
			}
		});
	});

	it(`Select 'redhat' catalog and check new components are available`, async function () {
		this.timeout(90_000);

		const catalogWindow = await openCatalogInListView();

		// check first component contains 'Red Hat' flag
		const provider = await getFirstCatalogItemProvider(catalogWindow);
		expect(provider).to.be.equal('Red Hat');

		// switch catalog window back to gallery view
		await switchBackCatalogToGalleryViewAndClose(catalogWindow);
	});

	it(`Select 'community' catalog and check "Red Hat" components are not available`, async function () {
		this.timeout(90_000);

		// expand dropdown
		const dropdown = await expandCatalogDropdown();

		// select Main > Camel Main X.X.X
		await selectDropdownItem('Main', dropdown);

		// it needs some time to start loading a new catalog
		await driver.sleep(1_000);

		// wait for reload of kaoto view
		await checkTopologyLoaded(driver, 15_000);

		const catalogWindow = await openCatalogInListView();

		// check first component contains 'Red Hat' flag
		const provider = await getFirstCatalogItemProvider(catalogWindow);
		expect(provider).to.not.be.equal('Red Hat');

		// switch catalog window back to gallery view
		await switchBackCatalogToGalleryViewAndClose(catalogWindow);
	});

	async function getFirstCatalogItemProvider(catalogWindow: WebElement): Promise<string> {
		const listItem = await catalogWindow.findElement(locators.KaotoView.catalog.list).findElement(locators.KaotoView.catalog.listItem);
		const provider = await listItem.findElement(locators.KaotoView.catalog.listItemProvider).getText();
		return provider;
	}

	async function openCatalogInListView(): Promise<WebElement> {
		// click Open Catalog
		const catalog = await driver.findElement(locators.KaotoView.catalogButton);
		await catalog.click();

		// wait catalog modal dialog is open
		await driver.wait(until.elementLocated(locators.KaotoView.catalog.window), 15_000);
		const catalogWindow = await driver.findElement(locators.KaotoView.catalog.window);

		// switch to list view
		await catalogWindow.findElement(locators.KaotoView.catalog.listButton).click();
		await driver.wait(until.elementLocated(locators.KaotoView.catalog.list), 5_000);

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

	async function expandCatalogDropdown(timeout: number = 2500): Promise<WebElement> {
		const dropdown = await driver.findElement(locators.CatalogDropDown.dropdown);
		await dropdown.click();
		await driver.wait(until.elementLocated(locators.RuntimeSelectorItems.list), timeout, 'Dropdown was not displayed properly!');
		return dropdown;
	}

	async function getDropdownItemsText(item: string, timeout: number = 2500): Promise<string[]> {
		// expand selected runtime list
		const parentItem = await driver.findElement(locators.RuntimeSelector.selector(item));
		try {
			await driver.actions().move({ origin: parentItem }).perform();
			await driver.wait(until.elementLocated(locators.RuntimeSelectorItems.submenu), timeout, 'Runtime selector sub-menu was not displayed properly!');
		} catch (error) {
			await parentItem.click();
			await driver.wait(until.elementLocated(locators.RuntimeSelectorItems.submenu), timeout, 'Runtime selector sub-menu was not displayed properly!');
		}

		// get all listed items
		const items = await parentItem.findElement(locators.RuntimeSelectorItems.list).findElements(locators.RuntimeSelectorItems.listItem);

		// get labels of all displayed items
		let labels: string[] = [];
		for (const item of items) {
			const label = await item.findElement(locators.RuntimeSelectorItems.label).getText();
			labels.push(label);
		}
		return labels;
	}

	async function selectDropdownItem(item: string, dropdown: WebElement, timeout: number = 2500) {
		const parentItem = await dropdown.findElement(locators.RuntimeSelector.selector(item));
		try {
			await driver.actions().move({ origin: parentItem }).perform();
			await driver.wait(until.elementLocated(locators.RuntimeSelectorItems.submenu), timeout, 'Runtime selector sub-menu was not displayed properly!');
		} catch (error) {
			await parentItem.click();
			await driver.wait(until.elementLocated(locators.RuntimeSelectorItems.submenu), timeout, 'Runtime selector sub-menu was not displayed properly!');
		}

		// select first Camel Main catalog item
		await parentItem.findElement(By.xpath(`//li[starts-with(@data-testid, 'runtime-selector-Camel Main')]`)).click();
	}
});
