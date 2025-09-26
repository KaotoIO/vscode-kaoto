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
	try {
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
			`Failed while waiting on terminal to has text: ${textArray}.`,
			interval,
		);
	} catch {
		throw new Error(`Failed while waiting on terminal to has text: ${textArray}.\n${await retrieveTextOfAllTerminals()}`);
	}
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
			try {
				await collapseMcpServersAndRecommendedView();
			} catch (error) {
				if (error instanceof Error) {
					if (
						!error.message.includes(`No section with title 'MCP Servers' found`) &&
						!error.message.includes(`No section with title 'Recommended' found`)
					) {
						throw Error(error.message);
					}
				}
			}
			await VSBrowser.instance.driver.sleep(interval);
			await VSBrowser.instance.driver.wait(
				async function () {
					return await extensionIsActivated('Kaoto');
				},
				timeout,
				`The Kaoto extension was not activated after ${timeout} sec.`,
				interval,
			);
		}
	});
}

async function collapseMcpServersAndRecommendedView(): Promise<void> {
	const extensionsControl = await new ActivityBar().getViewControl('Extensions');
	const extensionsView = await extensionsControl?.openView();
	const mcp = (await extensionsView?.getContent().getSection('MCP Servers')) as ExtensionsViewSection;
	await mcp.collapse();
	const recommended = (await extensionsView?.getContent().getSection('Recommended')) as ExtensionsViewSection;
	await recommended.collapse();
	await extensionsControl?.closeView();
}

async function extensionIsActivated(displayName: string): Promise<boolean> {
	try {
		const extensionsControl = await new ActivityBar().getViewControl('Extensions');
		const extensionsView = await extensionsControl?.openView();
		const marketplace = (await extensionsView?.getContent().getSection('Installed')) as ExtensionsViewSection;
		const item = (await marketplace.findItem(`@installed ${displayName}`)) as ExtensionsViewItem;
		const activationTime = await item.findElement(By.className('activationTime'));
		if (activationTime) {
			await extensionsControl?.closeView();
			return true;
		} else {
			return false;
		}
	} catch (err) {
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

async function retrieveTextOfAllTerminals(): Promise<string> {
	let res: string = '';
	try {
		const terminal = await activateTerminalView();
		const currentChannelName = await terminal.getCurrentChannel();
		const channelNames = await terminal.getChannelNames();
		for (let channelName in channelNames) {
			res += channelName + '\n';
			await terminal.selectChannel(channelName);
			res += await terminal.getText();
			res += '\n';
		}
		await terminal.selectChannel(currentChannelName);
		return res;
	} catch (ex) {
		return `Wasn't able to retrieve text of all terminals due to ${ex}. But retrieved: ${res}`;
	}
}
