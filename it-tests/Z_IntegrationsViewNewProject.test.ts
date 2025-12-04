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
import { expect } from 'chai';
import { join } from 'path';
import fs from 'fs';
import {
	ActivityBar,
	after,
	before,
	By,
	EditorView,
	InputBox,
	ModalDialog,
	SideBarView,
	TreeItem,
	until,
	ViewControl,
	ViewItemAction,
	ViewSection,
	VSBrowser,
	WebDriver,
} from 'vscode-extension-tester';
import { expandFolderItemsInIntegrationsView, getTreeItem, getTreeItemActionButton, openResourcesAndWaitForActivation } from './Util';

/**
 * This test needs to be always executed as last in suite
 */
describe('Integrations View', function () {
	this.timeout(240_000);

	const WORKSPACE_FOLDER = join(__dirname, '../test Fixture with speci@l chars', 'kaoto-view');

	let driver: WebDriver;
	let kaotoViewContainer: ViewControl | undefined;
	let kaotoView: SideBarView | undefined;
	let integrationsSection: ViewSection | undefined;

	before(async function () {
		driver = VSBrowser.instance.driver;
		await openResourcesAndWaitForActivation(WORKSPACE_FOLDER);

		kaotoViewContainer = await new ActivityBar().getViewControl('Kaoto');
		kaotoView = await kaotoViewContainer?.openView();
		integrationsSection = await kaotoView?.getContent().getSection('Integrations');

		await expandFolderItemsInIntegrationsView(integrationsSection, 'kamelets');
	});

	after(async function () {
		await kaotoViewContainer?.closeView();
		await new EditorView().closeAllEditors();
	});

	it(`'Export' button is available`, async function () {
		const exportButton = await getItemExportButton('kam1.kamelet.yaml');
		expect(exportButton).to.not.be.undefined;
	});

	describe(`Click 'Export' button`, function () {
		const PROJECT_OUTPUT_DIR: string = join(WORKSPACE_FOLDER, 'quarkus-export-example');

		let input: InputBox;
		let exportButton: ViewItemAction | undefined;

		before(async function () {
			fs.mkdirSync(PROJECT_OUTPUT_DIR, { recursive: true });
			exportButton = await getItemExportButton('sample1.camel.yaml');
			await exportButton?.click();
		});

		after(async function () {
			await new EditorView().closeAllEditors();
			fs.rmSync(PROJECT_OUTPUT_DIR, { force: true, recursive: true });
		});

		it(`Create a new Quarkus project`, async function () {
			// runtime selection
			input = await InputBox.create(30_000);
			await input.setText('quarkus');
			await input.confirm();

			// GAV selection
			input = await InputBox.create(30_000);
			await input.confirm();

			// specify new project output dir
			input = await InputBox.create(30_000);
			await input.setText(PROJECT_OUTPUT_DIR);
			await input.confirm();

			const nextButton = await input.findElement(By.className('monaco-button'));
			if (nextButton && (await nextButton.getText()) === 'Select') {
				/**
				 * when the provided path is not exactly formatted to the OS specificities, there is first a `Select` button and then a `Confirm`
				 * see also see https://github.com/redhat-developer/vscode-extension-tester/issues/1778
				 */
				await input.confirm();
			}

			const dialog = new ModalDialog();
			await driver.wait(
				async function () {
					return await dialog.isDisplayed();
				},
				10_000,
				'Modal Dialog was not displayed properly!',
			);
			await dialog.pushButton('Continue');
			await dialog.getDriver().wait(until.stalenessOf(dialog), 2_500, 'Dialog did not disappeared');

			await waitUntilNewCamelProjectHasCrucialFiles();
		});

		async function waitUntilNewCamelProjectHasCrucialFiles(): Promise<void> {
			// expand folders
			await expandFolderItemsInIntegrationsView(integrationsSection, 'src', 'main', 'resources', 'camel');
			await driver.wait(
				async function () {
					const items = (await integrationsSection?.getVisibleItems()) as TreeItem[];
					const item = items.find(async (item) => {
						return (await item.getDescription()) === 'quarkus-export-example/src/main/resources/camel';
					});
					return item && fs.existsSync(join(PROJECT_OUTPUT_DIR, 'pom.xml'));
				},
				180_000,
				`New Camel Project was not created properly!`,
				2_000,
			);
		}
	});

	async function getItemExportButton(treeItemLabel: string): Promise<ViewItemAction | undefined> {
		let exportButton: ViewItemAction | undefined = undefined;
		await driver.wait(
			async () => {
				try {
					const item = await getTreeItem(driver, integrationsSection, treeItemLabel);
					expect(item).to.not.be.undefined;
					exportButton = await getTreeItemActionButton(kaotoViewContainer, item as TreeItem, 'Export');
					return exportButton !== undefined;
				} catch (error) {
					return undefined;
				}
			},
			5_000,
			`Cannot get 'Export' action button for a '${treeItemLabel}'`,
		);
		return exportButton;
	}
});
