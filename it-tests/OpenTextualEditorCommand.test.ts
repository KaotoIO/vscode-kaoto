import { EditorView, TextEditor } from 'vscode-extension-tester';
import { expect } from 'chai';
import * as path from 'path';
import * as os from 'os';
import { openResourcesAndWaitForActivation } from './Util';

describe('Toggle Source Code', function () {
	this.timeout(30_000);

	const WORKSPACE_FOLDER: string = path.join(__dirname, '../test Fixture with speci@l chars');
	const CAMEL_FILE: string = 'my.camel.yaml';

	let editorView: EditorView;

	let actionTitle = 'Open Source Code';
	if (os.platform() === 'darwin') {
		actionTitle += ' (⌘K V)';
	} else {
		actionTitle += ' (Ctrl+K V)';
	}

	beforeEach(async function () {
		await openResourcesAndWaitForActivation(path.join(WORKSPACE_FOLDER, CAMEL_FILE));
		editorView = new EditorView();
		await clickEditorAction(editorView, actionTitle);
	});

	afterEach(async function () {
		await editorView.closeAllEditors();
	});

	it('open text editor to the side', async function () {
		const groupsNum = await waitForEditorGroupsLength(2);
		expect(groupsNum).to.equal(2);

		const editor = new TextEditor(await editorView.getEditorGroup(1));
		expect(await editor.getTextAtLine(1)).contains('- route:');
	});

	it('close text editor', async function () {
		await waitForEditorGroupsLength(2);
		await editorView.openEditor(CAMEL_FILE, 1); // re-activate editor
		await clickEditorAction(editorView, 'Close Source Code', 1);

		const groupsNum = await waitForEditorGroupsLength(1);
		expect(groupsNum).to.equal(1);
	});

	async function clickEditorAction(
		editorView: EditorView,
		actionLabel: string,
		groupIndex?: number,
		timeout: number = 5_000,
		interval: number = 1_500,
	): Promise<void> {
		await editorView.getDriver().sleep(interval);
		await editorView.getDriver().wait(
			async () => {
				try {
					const action = await editorView.getAction(actionLabel, groupIndex);
					if (action !== undefined) {
						await action.click();
						return true;
					} else {
						return false;
					}
				} catch {
					return false;
				}
			},
			timeout,
			`Cannot click on editor action button in ${timeout}ms`,
			interval,
		);
	}

	async function waitForEditorGroupsLength(length: number, timeout: number = 5_000): Promise<number> {
		await editorView.openEditor(CAMEL_FILE); // re-activate editor
		await editorView.getDriver().wait(
			async () => {
				const currentLength = (await editorView.getEditorGroups()).length;
				return currentLength === length;
			},
			timeout,
			`The editor group length (expected: ${length}) was not satisfied.`,
		);
		return (await editorView.getEditorGroups()).length;
	}
});
