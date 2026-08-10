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
	createWaitHelper,
	CustomEditor,
	EditorView,
	ExtensionsViewItem,
	ExtensionsViewSection,
	InputBox,
	ModalDialog,
	SideBarView,
	StatusBar,
	TerminalView,
	TreeItem,
	ViewControl,
	ViewItemAction,
	ViewPanelAction,
	ViewSection,
	VSBrowser,
	WebDriver,
	WebElement,
	WebView,
} from 'vscode-extension-tester';
import { KaotoEditor } from './pageObjects/KaotoEditor';
import { kaotoLocators } from './pageObjects/locators';

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
				for (const text of textArray) {
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
		// Only wait for the editor tab to exist. It is deliberately not required to be the
		// *active* one here: a panel opened during extension activation (the "What's New"
		// webview, which uses `ViewColumn.Active`) can take focus and never hand it back,
		// which used to fail this wait outright. Making the Kaoto editor active is
		// `switchToKaotoFrame`'s job, where it can be retried and verified.
		await driver.wait(
			async () => (await new EditorView().getOpenEditorTitles()).includes(fileNameToOpen),
			timeout,
			`Cannot open file '${fileNameToOpen}' in ${timeout}ms`,
			interval,
		);
	});
	return await switchToKaotoFrame(driver, checkNotDirty, fileNameToOpen);
}

/**
 * Switch the driver into the Kaoto editor webview.
 *
 * Two ExTester behaviours make a naive `switchToFrame()` unreliable, so the result is
 * always verified before it is handed back:
 *
 * 1. `WebviewMixin.switchToFrame()` does `if (!view) return;` -- when no webview iframe
 *    matches it resolves successfully without switching, leaving the driver in the
 *    workbench DOM.
 * 2. `WebView.getViewToSwitchTo()` picks the iframe with the largest rect overlap with
 *    the editor. Two webviews stacked in one editor group (for instance the Kaoto editor
 *    plus the "What's New" panel, which opens with `ViewColumn.Active`) have identical
 *    rects, so geometry cannot tell them apart.
 *
 * Both failures otherwise surface much later as a `NoSuchElementError` naming a valid
 * Kaoto selector. Checking for `#envelope-app` -- the Kaoto webview root, absent from the
 * workbench DOM and from every other webview -- turns them into an immediate, honest error.
 *
 * @param driver The WebDriver instance.
 * @param checkNotDirty Assert the editor is not dirty when opening it.
 * @param expectedTitle Title of the editor tab the webview belongs to, when known.
 */
export async function switchToKaotoFrame(
	driver: WebDriver,
	checkNotDirty: boolean,
	expectedTitle?: string,
): Promise<{ kaotoWebview: WebView; kaotoEditor: CustomEditor }> {
	let kaotoEditor = new CustomEditor();
	if (checkNotDirty) {
		assert.isFalse(await kaotoEditor.isDirty(), 'The Kaoto editor should not be dirty when opening it.');
	}
	let kaotoWebview: WebView = kaotoEditor.getWebView();
	await driver.wait(
		async () => {
			try {
				await ensureKaotoEditorIsActive(expectedTitle);
				kaotoEditor = new CustomEditor();
				kaotoWebview = kaotoEditor.getWebView();
				await kaotoWebview.switchToFrame(10_000);
				if (await isInsideKaotoWebview(driver)) {
					return true;
				}
				// Landed in the workbench DOM or in a foreign webview -- get back out and retry.
				await kaotoWebview.switchBack();
				return false;
			} catch (exception) {
				console.log('failed to switch to frame ' + exception);
				return false;
			}
		},
		30000,
		'Failed to switch to the Kaoto editor webview',
		1000,
	);
	return { kaotoWebview, kaotoEditor };
}

/**
 * Whether the driver is currently inside the Kaoto editor webview.
 *
 * Requires the driver to already be switched into a frame; returns false when it is
 * still in the workbench document or inside some other extension's webview.
 */
async function isInsideKaotoWebview(driver: WebDriver): Promise<boolean> {
	const envelope = await driver.findElements(By.css(kaotoLocators.KaotoEditor.envelopeApp));
	return envelope.length > 0;
}

/**
 * Make sure the Kaoto editor -- not some other panel that stole focus -- is the active tab
 * before its webview is resolved, since `new CustomEditor()` binds to whatever is active.
 *
 * Only acts when the active tab is not already the expected one, so a suite that is behaving
 * normally pays nothing and VS Code is not fought for focus once per second. Focusing is best
 * effort: this runs inside a retry loop, and `#envelope-app` is what ultimately decides
 * success, so a transient failure here is worth another attempt rather than an exception.
 *
 * Callers that do not know which tab to expect skip this entirely and rely on the
 * `#envelope-app` verification alone.
 */
async function ensureKaotoEditorIsActive(expectedTitle?: string): Promise<void> {
	if (expectedTitle === undefined) {
		return;
	}
	try {
		const activeTab = await new EditorView().getActiveTab();
		if ((await activeTab?.getTitle()) === expectedTitle) {
			return;
		}
		await new EditorView().openEditor(expectedTitle);
	} catch (exception) {
		console.log(`failed to focus editor '${expectedTitle}' ` + exception);
	}
}

export async function checkEmptyCanvasLoaded(driver: WebDriver, timeout: number = 10_000) {
	await KaotoEditor.waitForEmptyCanvas(driver, timeout);
}

export async function checkTopologyLoaded(driver: WebDriver, timeout: number = 10_000) {
	await KaotoEditor.waitForTopology(driver, timeout);
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
	const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
	delete settings[id];
	fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4), 'utf-8');
}

/**
 * Dismiss a modal dialog if one is currently blocking the workbench.
 *
 * VS Code renders modals behind a full-window backdrop (`.monaco-dialog-modal-block`)
 * that swallows every click. A single undismissed dialog therefore fails every later
 * test in the run with `ElementClickInterceptedError`, naming whatever element that
 * test happened to click rather than anything to do with the real cause -- and the
 * suites that only *read* the UI keep passing, which makes the pattern hard to spot.
 *
 * The tests hit this with the "Do you want to save the changes you made to
 * settings.json?" prompt, because the settings helpers rewrite `settings.json` on disk
 * while VS Code still has it open.
 *
 * Best effort and safe to call unconditionally: it returns immediately when no dialog
 * is up, and reports whether it dismissed one.
 *
 * Falls back to 'Cancel' rather than to the opposite answer when the preferred button is
 * missing: 'Cancel' still clears the backdrop, while answering "Don't Save" to a caller
 * that asked to save would silently discard the change the test depends on.
 *
 * @param driver The WebDriver instance.
 * @param preferredButton Button to press when the dialog offers it.
 * @returns true when a dialog was dismissed.
 */
export async function dismissBlockingModal(driver: WebDriver, preferredButton: string = "Don't Save"): Promise<boolean> {
	if ((await driver.findElements(By.css('.monaco-dialog-modal-block'))).length === 0) {
		return false;
	}
	for (const button of [preferredButton, 'Cancel']) {
		try {
			await new ModalDialog().pushButton(button);
			return true;
		} catch {
			// dialog does not offer this button, try the next one
		}
	}
	console.log('a modal dialog is blocking the workbench and could not be dismissed');
	return false;
}

/**
 * Close editor with handling of 'Save/Don't Save' Modal dialog.
 *
 * Whether the dialog appears is decided by looking for it after the close, rather than
 * by probing the active editor with `TextEditor().isDirty()` beforehand: the editor
 * being closed is not always a text editor -- the Settings UI is the common case here --
 * so the old check could report "not dirty" and leave the prompt on screen, blocking
 * every subsequent test.
 *
 * @param title Title of opened active editor.
 * @param save true/false
 */
export async function closeEditor(title: string, save?: boolean) {
	await new EditorView().closeEditor(title);
	await dismissBlockingModal(VSBrowser.instance.driver, save ? 'Save' : "Don't Save");
}

export async function dismissHoverOverlay(driver: WebDriver) {
	const waitHelper = createWaitHelper(driver);
	const hoverContents = await driver.findElements(By.css('.hover-contents'));
	for (const hoverContent of hoverContents) {
		if (await hoverContent.isDisplayed()) {
			await driver
				.actions()
				.move({ x: 5, y: 5, origin: driver.findElement(By.css('body')) })
				.perform();
			await waitHelper.forNotVisible(hoverContent, { timeout: 2_000, message: 'Hover overlay is still visible' });
			break;
		}
	}
}

export async function clickWhenClickable(driver: WebDriver, element: WebElement, timeout = 5_000) {
	const waitHelper = createWaitHelper(driver);
	await waitHelper.forVisible(element, { timeout });
	await waitHelper.forEnabled(element, { timeout });
	await waitHelper.forStable(element, { timeout });
	await waitHelper.forClickable(element, { timeout });
	await element.click();
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
 * Uses status bar messages as the primary detection mechanism:
 * 1. "Kaoto: ..." in-progress messages indicate activation is ongoing
 * 2. "Kaoto: ... ready" or "not found" indicate activation finished
 * 3. Messages disappeared after being seen means "ready" was shown between polls
 * 4. No messages ever seen falls back to Extensions view activation time check
 *
 * @param extensionName Display name of the extension to check
 * @param timeout Maximum time to wait for activation in milliseconds
 * @param interval Polling interval in milliseconds
 */
export async function waitForExtensionActivation(extensionName: string, timeout: number, interval: number): Promise<void> {
	const driver = VSBrowser.instance.driver;
	let sawKaotoMessage = false;

	await driver.wait(
		async function () {
			const statusResult = await getKaotoStatusBarState();

			if (statusResult === 'ready') {
				return true;
			}

			if (statusResult === 'in-progress') {
				sawKaotoMessage = true;
				return false;
			}

			// No Kaoto status bar messages found
			if (sawKaotoMessage) {
				// Previously saw activation messages but now they're gone --
				// the transient "ready" message appeared and disappeared between polls
				return true;
			}

			// Never saw any Kaoto messages -- fall back to Extensions view check
			return await extensionIsActivated(extensionName);
		},
		timeout,
		`Extension '${extensionName}' was not activated within ${timeout}ms. ` +
			`Check that the extension activates properly and status bar messages complete.`,
		interval,
	);
}

type KaotoStatusBarState = 'ready' | 'in-progress' | 'none';

/**
 * Checks status bar items for Kaoto activation messages.
 *
 * @returns 'in-progress' if an activation message is found (e.g. "Kaoto: Checking JBang...")
 * @returns 'ready' if a completion message is found (e.g. "Kaoto: JBang ready", "Kaoto: JBang not found")
 * @returns 'none' if no Kaoto messages are present in the status bar
 */
async function getKaotoStatusBarState(): Promise<KaotoStatusBarState> {
	try {
		const statusBar = new StatusBar();
		const statusBarItems = await statusBar.getItems();

		for (const item of statusBarItems) {
			const text = await item.getText();
			if (text.includes('Kaoto:')) {
				if (text.includes('ready') || text.includes('not found')) {
					return 'ready';
				}
				return 'in-progress';
			}
		}
		return 'none';
	} catch (error) {
		return 'none';
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
	await explorerView?.getDriver().sleep(500);
	await explorerView?.closeView();
	await explorerView?.getDriver().sleep(500);
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
 * Expand folder items in Tree Structured View
 * @param treeStructuredSection The Tree Structured View section.
 * @param folderNames The names of the folders to expand.
 * @returns A Promise that resolves when the folders are expanded.
 */
export async function expandFolderItemsInTreeStructuredView(treeStructuredSection: ViewSection | undefined, ...folderNames: string[]): Promise<void> {
	for (const folderName of folderNames) {
		const folderItem = await treeStructuredSection?.findItem(folderName);
		await folderItem?.click();
		await treeStructuredSection?.getDriver().sleep(50);
	}
}

/**
 * Collapse items inside Integrations View
 * @param treeStructuredSection The Tree Structured View section.
 * @returns A Promise that resolves when the items are collapsed.
 */
export async function collapseItemsInsideTreeStructuredView(treeStructuredSection: ViewSection | undefined): Promise<void> {
	const driver = treeStructuredSection?.getDriver();
	if (driver) {
		const collapseItems = await driver.wait(
			async function () {
				await driver.actions().move({ origin: treeStructuredSection, duration: 1_000 }).perform(); // move mouse to bring auto-hided buttons visible again
				await driver.sleep(500); // wait for the buttons to be visible
				return await treeStructuredSection?.getAction('Collapse All');
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

/**
 * Close views by name
 * @param kaotoViewContainer The Kaoto view container.
 * @param views The names of the views to collapse.
 * @returns A Promise that resolves when the views are closed.
 */
export async function collapseViews(kaotoView: SideBarView | undefined, ...views: string[]): Promise<void> {
	if (kaotoView) {
		for (const view of views) {
			const section = await kaotoView.getContent().getSection(view);
			if (section) {
				await section.collapse();
				await kaotoView.getContent().getDriver().sleep(50);
			}
		}
	}
}

/**
 * Expand views by name
 * @param kaotoViewContainer The Kaoto view container.
 * @param views The names of the views to expand.
 * @returns A Promise that resolves when the views are expanded.
 */
export async function expandViews(kaotoView: SideBarView | undefined, ...views: string[]): Promise<void> {
	if (kaotoView) {
		for (const view of views) {
			const section = await kaotoView.getContent().getSection(view);
			await section?.expand();
			await section?.getDriver().wait(
				async () => {
					const items = await section?.getVisibleItems();
					if (items && items?.length > 0) {
						return items as TreeItem[];
					} else {
						return undefined;
					}
				},
				5_000,
				`${view} section items were not loaded properly`,
				500,
			);
		}
	}
}

/**
 * Get Kaoto view control and collapse all views
 * @returns A Promise that resolves to the Kaoto view control.
 */
export async function getKaotoViewControl(): Promise<{ kaotoViewContainer: ViewControl | undefined; kaotoView: SideBarView | undefined }> {
	const kaotoViewContainer = await new ActivityBar().getViewControl('Kaoto');
	const kaotoView = await kaotoViewContainer?.openView();
	await collapseViews(kaotoView, 'Integrations', 'Deployments', 'OpenAPI', 'Tests', 'Help & Feedback');
	return { kaotoViewContainer, kaotoView };
}

/**
 * Handle input path selection
 * When the provided path is not exactly formatted to the OS specificities, there is first a `Select` button and then a `Confirm`
 * See also https://github.com/redhat-developer/vscode-extension-tester/issues/1778
 * @param input The input box to handle the path selection.
 */
export async function handleInputPathSelection(input: InputBox): Promise<void> {
	const nextButton = await input.findElement(By.className('monaco-button'));
	if (nextButton && (await nextButton.getText()) === 'Select') {
		await input.confirm(); // confirm the path selection
	}
}
