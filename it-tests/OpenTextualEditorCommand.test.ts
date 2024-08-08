import {
  EditorView,
  TextEditor,
  VSBrowser,
  Workbench,
} from 'vscode-extension-tester';
import { expect } from 'chai';
import * as path from 'path';

describe('Open Textual editor to the side', function () {
  this.timeout(20_000);

  const workspaceFolder = path.join(__dirname, '../test Fixture with speci@l chars');

  before(async function () {
    this.timeout(20_000);
  });

  afterEach(async function () {
    const editorView = new EditorView();
    await editorView.closeAllEditors();
  });

  it('Use command from palette', async function () {
    const filePath = path.join(workspaceFolder, 'my.camel.yaml');
    await VSBrowser.instance.openResources(filePath);
    const editorView = new EditorView();
    expect(await editorView.getEditorGroups()).to.have.length(1);

    await new Workbench().executeCommand('Open Camel file with textual editor on the side');

    expect(await editorView.getEditorGroups()).to.have.length(2);
    const editor = new TextEditor(await editorView.getEditorGroup(1));
    expect(await editor.getTextAtLine(1)).contains('- route:');
  });
});
