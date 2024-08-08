import {
  EditorView,
  TextEditor,
  VSBrowser,
  Workbench,
} from 'vscode-extension-tester';
import { expect } from 'chai';
import * as path from 'path';

describe.only('Open Textual editor to the side', function () {
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
    const editorView = await openFileInKaotoEditor(workspaceFolder);

    await new Workbench().executeCommand('Open Camel file with textual editor on the side');

    await checkTextualEditorIsOpenedOnTheSide(editorView);
  });

  it('Use quick action', async function () {
    const editorView = await openFileInKaotoEditor(workspaceFolder);

    (await editorView.getAction('Open Camel file with textual editor on the side'))?.click();

    await checkTextualEditorIsOpenedOnTheSide(editorView);
  });
});

async function checkTextualEditorIsOpenedOnTheSide(editorView: EditorView) {
  expect(await editorView.getEditorGroups()).to.have.length(2);
  const editor = new TextEditor(await editorView.getEditorGroup(1));
  expect(await editor.getTextAtLine(1)).contains('- route:');
}

async function openFileInKaotoEditor(workspaceFolder: string) {
  const filePath = path.join(workspaceFolder, 'my.camel.yaml');
  await VSBrowser.instance.openResources(filePath);
  const editorView = new EditorView();
  expect(await editorView.getEditorGroups()).to.have.length(1);
  return editorView;
}
