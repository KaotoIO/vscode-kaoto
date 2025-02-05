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
  ActivityBar,
  ContextMenu,
  EditorView,
  SideBarView,
  TextEditor,
  ViewControl,
  ViewSection,
  VSBrowser,
  WebDriver,
  Workbench,
} from 'vscode-extension-tester';
import { assert, expect } from 'chai';
import * as path from 'path';
import { checkEmptyCanvasLoaded, switchToKaotoFrame } from './Util';

describe('Contextual menu opening', function () {
  this.timeout(60_000);

  const workspaceFolder = path.join(__dirname, '../test Fixture with speci@l chars');

  let driver: WebDriver;

  before(async function () {
    this.timeout(60_000);
    driver = VSBrowser.instance.driver;
  });

  afterEach(async function () {
    const editorView = new EditorView();
    await editorView.closeAllEditors();
  });

  it('Open Camel file with name my.yaml with right-click and check Kaoto UI is loading', async function () {
    if (process.platform === 'darwin') {
      // Contextual Menu is not implemented On MacOS in VS Code Extension tester
      // See https://github.com/redhat-developer/vscode-extension-tester/issues/409#issuecomment-1209710394
      this.skip();
    }

    const control: ViewControl | undefined = await new ActivityBar().getViewControl('Explorer');
    if (control === undefined) {
      assert.fail('Not found the Explorer view');
    }
    const explorerView: SideBarView = await control.openView();
    const workspaceSection: ViewSection = await explorerView
      .getContent()
      .getSection('test Fixture with speci@l chars');
    await workspaceSection.expand();
    await new Workbench().executeCommand('Refresh Explorer');
    const myYamlItem = await workspaceSection.findItem('my.yaml');
    if (myYamlItem === undefined) {
      assert.fail('Cannot find the my.yaml file in explorer.');
    }
    const contextMenu: ContextMenu = await myYamlItem.openContextMenu();
    await (await contextMenu.getItem('Open with Kaoto'))?.click();

    const { kaotoWebview, kaotoEditor } = await switchToKaotoFrame(driver, false);
    await checkEmptyCanvasLoaded(driver);
    await kaotoWebview.switchBack();
    await kaotoEditor.save();
  });

  it('Open Camel file with name my.yaml opens with text editor by default', async function () {
    const filePath = path.join(workspaceFolder, 'my.yaml');
    await VSBrowser.instance.openResources(filePath);
    const editor = new TextEditor();
    expect(await editor.getTextAtLine(1)).contains('- route:');
    await editor.save();
  });
});
