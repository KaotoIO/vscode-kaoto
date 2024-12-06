/**
 * Copyright 2024 Red Hat, Inc. and/or its affiliates.
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
import {
  EditorView,
  TextEditor,
  VSBrowser,
  Workbench,
} from 'vscode-extension-tester';
import { expect } from 'chai';
import * as path from 'path';
import * as os from 'os';

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
    const editorView = await openFileInKaotoEditor(workspaceFolder);

    await new Workbench().executeCommand('Open Camel file with textual editor on the side');

    await checkTextualEditorIsOpenedOnTheSide(editorView);
  });

  it('Use quick action', async function () {
    const editorView = await openFileInKaotoEditor(workspaceFolder);

    let actionTitle;
    if(os.platform() === 'darwin') {
      actionTitle = 'Open Camel file with textual editor on the side (⌘K V)';
    } else {
      actionTitle = 'Open Camel file with textual editor on the side (Ctrl+K V)';
    }
    await (await editorView.getAction(actionTitle))?.click();

    await checkTextualEditorIsOpenedOnTheSide(editorView);
  });
});

async function checkTextualEditorIsOpenedOnTheSide(editorView: EditorView) {
  const driver = VSBrowser.instance.driver;
  await driver.wait(async() => {
    return (await editorView.getEditorGroups()).length === 2;
  }, 5000, 'The second editor group has not opened');
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
