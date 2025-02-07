import { EditorView, TextEditor, VSBrowser } from 'vscode-extension-tester';
import { expect } from 'chai';
import * as path from 'path';
import * as os from 'os';

describe('Toggle Source Code', function () {
    this.timeout(30_000);

    const WORKSPACE_FOLDER: string = path.join(__dirname, '../test Fixture with speci@l chars');
    const CAMEL_FILE: string = 'my.camel.yaml';

    let editorView: EditorView;

    before(async function () {
        await VSBrowser.instance.openResources(path.join(WORKSPACE_FOLDER, CAMEL_FILE));
        editorView = new EditorView();
    });

    after(async function () {
        await editorView.closeAllEditors();
    });

    it('open text editor to the side', async function () {
        let actionTitle = 'Open Source Code';
        if (os.platform() === 'darwin') {
            actionTitle += ' (⌘K V)';
        } else {
            actionTitle += ' (Ctrl+K V)';
        }
        await (await editorView.getAction(actionTitle))?.click();
        const groupsNum = await waitForEditorGroupsLength(2);
        expect(groupsNum).to.equal(2);

        const editor = new TextEditor(await editorView.getEditorGroup(1));
        expect(await editor.getTextAtLine(1)).contains('- route:');
    });

    it('close text editor', async function () {
        await (await editorView.getAction('Close Source Code', 1))?.click();
        const groupsNum = await waitForEditorGroupsLength(1);
        expect(groupsNum).to.equal(1);
    });

    async function waitForEditorGroupsLength(length: number, timeout: number = 5_000): Promise<number> {
        await editorView.getDriver().wait(async () => {
            const currentLength = (await editorView.getEditorGroups()).length;
            return currentLength === length;
        }, timeout, `The editor group length (expected: ${length}) was not satisfied.`);
        return (await editorView.getEditorGroups()).length;
    }

});
