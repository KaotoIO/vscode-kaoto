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
import { checkEmptyCanvasLoaded, openResourcesAndWaitForActivation, switchToKaotoFrame } from './Util';

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
		const workspaceSection: ViewSection = await explorerView.getContent().getSection('test Fixture with speci@l chars');
		await workspaceSection.expand();
		await new Workbench().executeCommand('Refresh Explorer');
		const myYamlItem = await workspaceSection.findItem('my.yaml');
		if (myYamlItem === undefined) {
			assert.fail('Cannot find the my.yaml file in explorer.');
		}
		const contextMenu: ContextMenu = await myYamlItem.openContextMenu();
		await (await contextMenu.getItem('Open with Kaoto Graphical Editor for Camel'))?.click();

		const { kaotoWebview, kaotoEditor } = await switchToKaotoFrame(driver, false);
		await checkEmptyCanvasLoaded(driver);
		await kaotoWebview.switchBack();
		await kaotoEditor.save();
	});

	it('Open Camel file with name my.yaml opens with text editor by default', async function () {
		const filePath = path.join(workspaceFolder, 'my.yaml');
		await openResourcesAndWaitForActivation(filePath);
		const editor = new TextEditor();
		expect(await editor.getTextAtLine(1)).contains('- route:');
		await editor.save();
	});
});
