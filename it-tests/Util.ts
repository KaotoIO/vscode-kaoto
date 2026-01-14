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
import { assert } from 'chai';
import * as path from 'path';
import * as fs from 'node:fs';
import * as os from 'os';
import {
	ActivityBar,
	BottomBarPanel,
	By,
	CustomEditor,
	EditorView,
	ExtensionsViewItem,
	ExtensionsViewSection,
	ModalDialog,
	StatusBar,
	TerminalView,
	TextEditor,
	TreeItem,
	until,
	ViewControl,
	ViewItemAction,
	ViewPanelAction,
	ViewSection,
	VSBrowser,
	WebDriver,
	WebView,
} from 'vscode-extension-tester';

export const CATALOG_VERSION_ID = 'kaoto.camelJbang.version';

/**
 * Checks if the terminal view has the specified texts in the given textArray.
 * @param driver The WebDriver instance to use.
 * @param textArray An array of strings representing the texts to search for in the terminal view.
 * @param interval (Optional) The interval in milliseconds to wait between checks. Default is 2000ms.
 * @param timeout (Optional) The timeout in milliseconds. Default is 60000ms.
 * @returns A Promise that resolves to a boolean indicating whether the terminal view has the texts or not.
 */
export async function waitUntilTerminalHasText(driver: WebDriver, textArray: string[], interval = 2000, timeout = 60000): Promise<void> {
	await driver.sleep(interval);
	await driver.wait(
		async function () {
			try {
				const terminal = await activateTerminalView();
				const terminalText = await terminal.getText();
				for await (const text of textArray) {
					if (!terminalText.includes(text)) {
						return false;
					}
				}
				return true;
			} catch (err) {
				return false;
			}
		},
		timeout,
		`Failed while waiting on terminal to has text: ${textArray}`,
		interval,
	);
}

/**
 * Click on button to kill running process in Terminal View
 */
export async function killTerminal(): Promise<void> {
	await (await activateTerminalView()).killTerminal();
}

/**
 * Ensures Terminal View is opened and focused
 * @returns A Promise that resolves to TerminalView instance.
 */
export async function activateTerminalView(): Promise<TerminalView> {
	return await new BottomBarPanel().openTerminalView();
}

export async function getTreeItem(
	driver: WebDriver,
	section: ViewSection | undefined,
	filename: string,
	timeout: number = 30_000,
): Promise<TreeItem | undefined> {
	return await driver.wait(
		async function () {
			try {
				return (await section?.findItem(filename)) as TreeItem;
			} catch (error) {
				return undefined;
			}
		},
		timeout,
		`${filename} was not found within ${await section?.getTitle()} view!`,
		500,
	);
}

export async function openAndSwitchToKaotoFrame(
	workspaceFolder: string,
	fileNameToOpen: string,
	driver: WebDriver,
	checkNotDirty: boolean,
	timeout: number = 10_000,
	interval: number = 2_000,
): Promise<{ kaotoWebview: WebView; kaotoEditor: CustomEditor }> {
	await VSBrowser.instance.openResources(path.join(workspaceFolder, fileNameToOpen), async () => {
		await driver.sleep(interval);
		await driver.wait(
			async () => {
				const editor = await new EditorView().getActiveTab();
				return (await editor?.getTitle()) === fileNameToOpen;
			},
			timeout,
			`Cannot open file '${fileNameToOpen}' in ${timeout}ms`,
			interval,
		);
	});
	return await switchToKaotoFrame(driver, checkNotDirty);
}

export async function switchToKaotoFrame(driver: WebDriver, checkNotDirty: boolean): Promise<{ kaotoWebview: WebView; kaotoEditor: CustomEditor }> {
	let kaotoEditor = new CustomEditor();
	if (checkNotDirty) {
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty when opening it.');
	}
	let kaotoWebview: WebView = kaotoEditor.getWebView();
	await driver.wait(
		async () => {
			try {
				kaotoEditor = new CustomEditor();
				kaotoWebview = kaotoEditor.getWebView();
				await kaotoWebview.switchToFrame();
				return true;
			} catch (exception) {
				console.log('failed to switch to frame ' + exception);
				return false;
			}
		},
		30000,
		'Failed to switch to frame',
		1000,
	);
	return { kaotoWebview, kaotoEditor };
}

export async function checkEmptyCanvasLoaded(driver: WebDriver, timeout: number = 10_000) {
	await driver.wait(until.elementLocated(By.xpath("//div[@data-testid='visualization-empty-state']")), timeout, 'Empty Kaoto Canvas was not loaded properly');
}

export async function checkTopologyLoaded(driver: WebDriver, timeout: number = 10_000) {
	await driver.wait(until.elementLocated(By.xpath("//div[@data-test-id='topology']")), timeout, 'Kaoto topology was not loaded properly');
}

// Enforce same default storage setup as ExTester - see https://github.com/redhat-developer/vscode-extension-tester/wiki/Test-Setup#useful-env-variables
export const storageFolder = process.env.TEST_RESOURCES ? process.env.TEST_RESOURCES : `${os.tmpdir()}/test-resources`;

/**
 * Reset user setting to default value by deleting item in settings.json.
 *
 * @param id ID of setting to reset.
 */
export function resetUserSettings(id: string): void {
	const settingsPath = path.resolve(storageFolder, 'settings', 'User', 'settings.json');
	const reset = fs
		.readFileSync(settingsPath, 'utf-8')
		.replace(new RegExp(`"${id}.*`), '')
		.replace(/,(?=[^,]*$)/, '');
	fs.writeFileSync(settingsPath, reset, 'utf-8');
}

/**
 * Close editor with handling of 'Save/Don't Save' Modal dialog.
 *
 * @param title Title of opened active editor.
 * @param save true/false
 */
export async function closeEditor(title: string, save?: boolean) {
	const dirty = await new TextEditor().isDirty();
	await new EditorView().closeEditor(title);
	if (dirty) {
		const dialog = new ModalDialog();
		if (save) {
			await dialog.pushButton('Save');
		} else {
			await dialog.pushButton("Don't Save");
		}
	}
}

export async function openResourcesAndWaitForActivation(
	path: string,
	waitForActivation: boolean = true,
	timeout: number = 150_000,
	interval: number = 2_500,
): Promise<void> {
	await VSBrowser.instance.openResources(path, async () => {
		await VSBrowser.instance.driver.sleep(interval);
		if (waitForActivation) {
			await waitForExtensionActivation('Kaoto', timeout, interval);
		}
	});
}

/**
 * Waits for the extension to be fully activated.
 *
 * The activation check follows this flow:
 * 1. Check if extension activation time is visible (indicates fully activated)
 * 2. If not activated, check status bar for "Kaoto:" messages (indicates activation in progress)
 * 3. If no status bar messages, re-check activation time (handles gap between status messages)
 * 4. Repeat until extension is fully activated or timeout is reached
 *
 * @param extensionName Display name of the extension to check
 * @param timeout Maximum time to wait for activation in milliseconds
 * @param interval Polling interval in milliseconds
 */
export async function waitForExtensionActivation(extensionName: string, timeout: number, interval: number): Promise<void> {
	const driver = VSBrowser.instance.driver;

	await driver.wait(
		async function () {
			// Step 1: Check if extension is already activated (activation time visible)
			const activated = await extensionIsActivated(extensionName);
			if (activated) {
				return true;
			}

			// Step 2: Extension not activated yet, check status bar for activation messages
			// During activation, Kaoto shows progress messages like "Kaoto: Checking requirements..."
			const hasKaotoStatusMessage = await checkStatusBarForKaotoMessages();
			if (hasKaotoStatusMessage) {
				// Still showing activation messages, extension is activating - continue waiting
				return false;
			}

			// Step 3: No status bar messages found, check activation time one more time
			// This handles the brief gap between status messages during activation
			const activatedFinal = await extensionIsActivated(extensionName);
			if (activatedFinal) {
				return true;
			}

			// Not activated yet and no status messages - continue polling
			return false;
		},
		timeout,
		`Extension '${extensionName}' was not activated within ${timeout}ms. ` +
			`Check that the extension activates properly and status bar messages complete.`,
		interval,
	);
}

/**
 * Checks if any status bar item contains a message starting with "Kaoto:".
 * These messages indicate the extension is in the process of activating
 * (e.g., "Kaoto: Checking requirements...", "Kaoto: Loading catalogs...").
 *
 * @returns true if a Kaoto status message is found, false otherwise
 */
async function checkStatusBarForKaotoMessages(): Promise<boolean> {
	try {
		const statusBar = new StatusBar();
		const statusBarItems = await statusBar.getItems();

		const kaotoStatusBarMsg = await statusBarItems[2].getText();
		if (kaotoStatusBarMsg.startsWith('Kaoto:')) {
			return false;
		} else {
			return true;
		}
	} catch (error) {
		// Status bar might not be accessible, treat as no messages
		return false;
	}
}

/**
 * Open the extension page.
 * @param name Display name of the extension.
 * @param timeout Timeout in ms.
 * @returns A tuple -- marketplace and ExtensionViewItem object tied with the extension.
 */
async function openExtensionPage(name: string, timeout: number): Promise<ExtensionsViewItem> {
	let item: ExtensionsViewItem;
	const driver = VSBrowser.instance.driver;

	await driver.wait(
		async () => {
			try {
				const extensionsView = await (await new ActivityBar().getViewControl('Extensions'))?.openView();
				const marketplace = (await extensionsView?.getContent().getSection('Installed')) as ExtensionsViewSection;
				item = (await marketplace.findItem(`@installed ${name}`)) as ExtensionsViewItem;
				return true;
			} catch (e) {
				return false;
			}
		},
		timeout,
		'Page was not rendered',
	);
	return item!;
}

async function extensionIsActivated(displayName: string): Promise<boolean> {
	let extensionControl = await new ActivityBar().getViewControl('Extensions');
	try {
		const item = await openExtensionPage(displayName, 10_000);
		const activationTime = await item?.findElement(By.className('activationTime'));
		if (activationTime) {
			await extensionControl?.closeView();
			return true;
		} else {
			await extensionControl?.closeView();
			return false;
		}
	} catch (err) {
		await extensionControl?.closeView();
		return false;
	}
}

/**
 * Workaround for https://github.com/KaotoIO/kaoto/issues/2571
 */
export async function workaroundToRedrawContextualMenu(kaotoWebview: WebView) {
	await kaotoWebview.switchBack();
	const explorerView = await new ActivityBar().getViewControl('Explorer');
	await explorerView?.openView();
	await explorerView?.closeView();
	await kaotoWebview.switchToFrame();
}

/**
 * Set user setting directly inside settings.json
 *
 * @param id ID of setting.
 * @param value Value of setting.
 */
export function setUserSettingsDirectly(id: string, value: string): void {
	const settingsPath = path.resolve(storageFolder, 'settings', 'User', 'settings.json');
	const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
	settings[id] = value;
	fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4), 'utf-8');
}

/**
 * Read user setting from settings.json
 *
 * @param id ID of setting.
 * @returns Value of setting.
 */
export function readUserSetting(id: string): string {
	const settingsPath = path.resolve(storageFolder, 'settings', 'User', 'settings.json');
	const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
	return settings[id];
}

/**
 * Expand folder items in Integrations View
 * @param integrationsSection The Integrations View section.
 * @param folderNames The names of the folders to expand.
 * @returns A Promise that resolves when the folders are expanded.
 */
export async function expandFolderItemsInIntegrationsView(integrationsSection: ViewSection | undefined, ...folderNames: string[]): Promise<void> {
	for (const folderName of folderNames) {
		const folderItem = await integrationsSection?.findItem(folderName);
		await folderItem?.click();
	}
}

/**
 * Collapse items inside Integrations View
 * @param integrationsSection The Integrations View section.
 * @returns A Promise that resolves when the items are collapsed.
 */
export async function collapseItemsInsideIntegrationsView(integrationsSection: ViewSection | undefined): Promise<void> {
	const driver = integrationsSection?.getDriver();
	if (driver) {
		const collapseItems = await driver.wait(
			async function () {
				await driver.actions().move({ origin: integrationsSection, duration: 1_000 }).perform(); // move mouse to bring auto-hided buttons visible again
				await driver.sleep(500); // wait for the buttons to be visible
				return await integrationsSection?.getAction('Collapse All');
			},
			5_000,
			`'Collapse All' button was not found!`,
		);
		await collapseItems?.click();
	} else {
		throw new Error('Driver not found');
	}
}

/**
 * Get action button from view section
 * @param section The view section.
 * @param action The action to get the button for.
 * @param timeout The timeout in milliseconds.
 * @returns A Promise that resolves to the action button or undefined if not found.
 */
export async function getViewActionButton(
	kaotoViewContainer: ViewControl | undefined,
	section: ViewSection | undefined,
	action: string,
	timeout: number = 5_000,
): Promise<ViewPanelAction | undefined> {
	await reopenKaotoView(kaotoViewContainer);

	const driver = section?.getDriver();
	if (driver) {
		return await driver.wait(
			async function () {
				await driver.actions().move({ origin: section, duration: 1_000 }).perform(); // move mouse to bring auto-hided buttons visible again
				await driver.sleep(500); // wait for the buttons to be visible
				return await section?.getAction(action);
			},
			timeout,
			`'${action}' action button was not found!`,
			500,
		);
	} else {
		return undefined;
	}
}

export async function getTreeItemActionButton(
	kaotoViewContainer: ViewControl | undefined,
	treeItem: TreeItem,
	action: string,
	timeout: number = 5_000,
): Promise<ViewItemAction | undefined> {
	await reopenKaotoView(kaotoViewContainer);

	const driver = treeItem.getDriver();
	return await driver.wait(
		async function () {
			await driver.actions().move({ origin: treeItem, duration: 1_000 }).perform(); // move mouse to bring auto-hided buttons visible again
			await driver.sleep(500); // wait for the buttons to be visible
			return await treeItem.getActionButton(action);
		},
		timeout,
		`'${action}' action button was not found!`,
		500,
	);
}

/**
 * Reopen Kaoto view to workaround 'stale element reference: stale element not found in the current frame' ExTester issue
 * @param kaotoViewContainer The Kaoto view container.
 * @returns A Promise that resolves when the view is reopened.
 */
async function reopenKaotoView(kaotoViewContainer: ViewControl | undefined): Promise<void> {
	await kaotoViewContainer?.closeView();
	await kaotoViewContainer?.getDriver().sleep(500);
	await kaotoViewContainer?.openView();
}
