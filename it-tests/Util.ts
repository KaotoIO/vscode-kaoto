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
	TerminalView,
	TextEditor,
	TreeItem,
	until,
	ViewSection,
	VSBrowser,
	WebDriver,
	WebView,
} from 'vscode-extension-tester';

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
		undefined,
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
	timeout: number = 10_000,
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
	);
}

export async function openAndSwitchToKaotoFrame(
	workspaceFolder: string,
	fileNameToOpen: string,
	driver: WebDriver,
	checkNotDirty: boolean,
): Promise<{ kaotoWebview: WebView; kaotoEditor: CustomEditor }> {
	await VSBrowser.instance.openResources(path.join(workspaceFolder, fileNameToOpen));
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

export async function checkEmptyCanvasLoaded(driver: WebDriver) {
	await driver.wait(until.elementLocated(By.xpath("//div[@data-testid='visualization-empty-state']")));
}

export async function checkTopologyLoaded(driver: WebDriver, timeout: number = 10_000) {
	await driver.wait(until.elementLocated(By.xpath("//div[@data-test-id='topology']")), timeout);
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

export async function openResourcesAndWaitForActivation(path: string, timeout: number = 150_000, interval: number = 1_000): Promise<void> {
	await VSBrowser.instance.openResources(path);
	await VSBrowser.instance.waitForWorkbench();
	await VSBrowser.instance.driver.wait(
		async function () {
			return await extensionIsActivated('Kaoto');
		},
		timeout,
		`The Kaoto extension was not activated after ${timeout} sec.`,
		interval,
	);
}

async function extensionIsActivated(displayName: string): Promise<boolean> {
	try {
		const extensionsView = await (await new ActivityBar().getViewControl('Extensions'))?.openView();
		const marketplace = (await extensionsView?.getContent().getSection('Installed')) as ExtensionsViewSection;
		const item = (await marketplace.findItem(`@installed ${displayName}`)) as ExtensionsViewItem;
		const activationTime = await item.findElement(By.className('activationTime'));
		if (activationTime) {
			return true;
		} else {
			return false;
		}
	} catch (err) {
		return false;
	}
}
