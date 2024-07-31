import { ActivityBar, after, By, TextSetting, until, VSBrowser, WebDriver, WebView, Workbench } from 'vscode-extension-tester';
import { checkTopologyLoaded, closeEditor, openAndSwitchToKaotoFrame, resetUserSettings } from '../Util';
import { join } from 'path';
import { expect } from 'chai';

describe('User Settings', function () {
    this.timeout(90_000);

    const WORKSPACE_FOLDER = join(__dirname, '../../test Fixture with speci@l chars');
    const CATALOG_URL = 'https://raw.githubusercontent.com/KaotoIO/catalogs/main/catalogs/index.json';
    const CATALOG_SETTINGS_ID = 'kaoto.catalog.url';

    let driver: WebDriver;
    let kaotoWebview: WebView;

    const locators = {
        CatalogDropDown: {
            dropdown: By.xpath(`//button[@data-testid='runtime-selector-list-dropdown']`)
        },
        RuntimeSelector: {
            selector: (label: string) => By.xpath(`//li[@data-testid='runtime-selector-${label}']`)
        },
        RuntimeSelectorItems: {
            list: By.className('pf-v5-c-menu__list'),
            listItem: By.className('pf-v5-c-menu__list-item'),
            label: By.className('pf-v5-c-menu__item-text')
        }
    }

    before(async function () {
        this.timeout(60_000);
        driver = VSBrowser.instance.driver;
        await VSBrowser.instance.openResources(WORKSPACE_FOLDER);
        await VSBrowser.instance.waitForWorkbench();

        // provide the Catalog URL using Settings UI editor
        const settings = await new Workbench().openSettings();
        const textSetting = await driver.wait(async () => {
            return await settings.findSetting('Url', 'Kaoto', 'Catalog') as TextSetting;
        })
        await textSetting.setValue(CATALOG_URL);
        await driver.sleep(1_000); // stabilize tests which are sometimes failing on macOS CI
        await closeEditor('Settings', true);

        // close sidebar
        await (await new ActivityBar().getViewControl('Explorer'))?.closeView();

        // open the integration file using Kaoto editor
        kaotoWebview = (await openAndSwitchToKaotoFrame(
            WORKSPACE_FOLDER,
            'my.camel.yaml',
            driver,
            true
        )).kaotoWebview;
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

    const runtimeSelectors = ['Main', 'Quarkus', 'SpringBoot'];

    runtimeSelectors.forEach(function (runtime) {

        it(`Check custom Kaoto catalog loaded - ${runtime}`, async function () {
            this.timeout(60_000);

            // expand Catalog dropdown
            const dropdown = await driver.findElement(locators.CatalogDropDown.dropdown);
            await dropdown.click();
            await driver.wait(
                until.elementLocated(locators.RuntimeSelectorItems.list
                ), 5_000, 'Dropdown was not displayed properly!');

            // get all items available for selected runtime
            let items = await getDropdownItemsText(runtime);
            expect(items.length).is.greaterThan(1);

            // collapse catalog dropdown
            await dropdown.click();
            try {
                await driver.wait(
                    until.elementLocated(locators.RuntimeSelectorItems.list
                    ), 5_000);
                throw new Error('Dropdown was not closed!')
            } catch (error) {
                if (error.name !== 'TimeoutError') {
                    throw new Error(error.message);
                }
            }
        });
    });


    async function getDropdownItemsText(item: string): Promise<string[]> {
        // expand selected runtime list
        const parentItem = await driver.findElement(locators.RuntimeSelector.selector(item));
        await parentItem.click();

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
});
