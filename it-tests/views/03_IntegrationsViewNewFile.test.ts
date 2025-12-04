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
	afterEach,
	before,
	beforeEach,
	By,
	EditorView,
	InputBox,
	SideBarView,
	until,
	ViewControl,
	ViewPanelActionDropdown,
	ViewSection,
	VSBrowser,
	WebDriver,
} from 'vscode-extension-tester';
import {
	collapseItemsInsideIntegrationsView,
	expandFolderItemsInIntegrationsView,
	getTreeItem,
	openResourcesAndWaitForActivation,
	switchToKaotoFrame,
} from '../Util';

describe('Integrations View', function () {
	this.timeout(240_000);

	const WORKSPACE_FOLDER = join(__dirname, '../../test Fixture with speci@l chars', 'kaoto-view');

	let driver: WebDriver;
	let kaotoViewContainer: ViewControl | undefined;
	let kaotoView: SideBarView | undefined;
	let integrationsSection: ViewSection | undefined;
	let deploymentsSection: ViewSection | undefined;
	let newFileButton: ViewPanelActionDropdown | undefined;

	before(async function () {
		driver = VSBrowser.instance.driver;
		await openResourcesAndWaitForActivation(WORKSPACE_FOLDER, false);

		kaotoViewContainer = await new ActivityBar().getViewControl('Kaoto');
		kaotoView = await kaotoViewContainer?.openView();
		await (await kaotoView?.getContent().getSection('Help & Feedback'))?.collapse();
		deploymentsSection = await kaotoView?.getContent().getSection('Deployments');
		await deploymentsSection?.collapse();
		integrationsSection = await kaotoView?.getContent().getSection('Integrations');

		// expand folders
		await expandFolderItemsInIntegrationsView(integrationsSection, 'kamelets', 'pipes', 'others');
	});

	after(async function () {
		await collapseItemsInsideIntegrationsView(integrationsSection);
		await deploymentsSection?.expand();
		await kaotoViewContainer?.closeView();
		await new EditorView().closeAllEditors();
	});

	it(`'New File...' button is available`, async function () {
		newFileButton = (await integrationsSection?.getAction('New File...')) as ViewPanelActionDropdown;
		expect(newFileButton).to.not.be.undefined;
	});

	describe(`Click 'New File...' button`, function () {
		const CAMEL_ROUTE_YAML_FILE: string = 'newSample.camel.yaml';
		const CAMEL_ROUTE_XML_FILE: string = 'newSample.camel.xml';
		const KAMELET_FILE: string = 'newKam-sink.kamelet.yaml';
		const PIPE_FILE: string = 'newPipe.pipe.yaml';

		let input: InputBox;

		beforeEach(async function () {
			newFileButton = await driver.wait(
				async function () {
					await driver.actions().move({ origin: integrationsSection, duration: 1_000 }).perform(); // move mouse to bring auto-hided buttons visible again
					await driver.sleep(500); // wait for the buttons to be visible
					return (await integrationsSection?.getAction('New File...')) as ViewPanelActionDropdown;
				},
				10_000,
				`'New File...' button was not found!`,
			);
		});

		afterEach(async function () {
			await new EditorView().closeAllEditors();
		});

		after(function () {
			fs.rmSync(join(WORKSPACE_FOLDER, CAMEL_ROUTE_YAML_FILE), { force: true });
			fs.rmSync(join(WORKSPACE_FOLDER, CAMEL_ROUTE_XML_FILE), { force: true });
			fs.rmSync(join(WORKSPACE_FOLDER, 'kamelets', KAMELET_FILE), { force: true });
			fs.rmSync(join(WORKSPACE_FOLDER, 'pipes', 'others', PIPE_FILE), { force: true });
		});

		const dsls = [
			{ label: 'YAML', fileName: CAMEL_ROUTE_YAML_FILE },
			{ label: 'XML', fileName: CAMEL_ROUTE_XML_FILE },
		];

		dsls.forEach(function (dsl) {
			it(`Check new 'Camel Route using ${dsl.label} DSL' can be created`, async function () {
				const menu = await newFileButton?.open();
				await menu?.select('New Camel Route...');

				input = await InputBox.create(30_000);
				await input.setText(dsl.label);
				await input.confirm();

				input = await InputBox.create(30_000);
				await input.confirm();

				input = await InputBox.create(30_000);
				await input.setText('newSample');
				await input.confirm();

				const newCamelRoute = await getTreeItem(driver, integrationsSection, dsl.fileName, 120_000);
				expect(newCamelRoute).to.not.be.undefined;

				await switchToKaotoAndCheckIntegrationType(dsl.fileName, 'Camel Route', 'setBody');
			});
		});

		it(`Check new 'Kamelet' can be created`, async function () {
			const menu = await newFileButton?.open();
			await menu?.select('New Kamelet...');

			input = await InputBox.create(30_000);
			await input.setText(join(WORKSPACE_FOLDER, 'kamelets'));
			await input.confirm();
			await handleInputPathSelection();

			input = await InputBox.create(30_000);
			await input.setText('sink');
			await input.confirm();

			input = await InputBox.create(30_000);
			await input.setText('newKam');
			await input.confirm();

			const newKamelet = await getTreeItem(driver, integrationsSection, KAMELET_FILE, 120_000);
			expect(newKamelet).to.not.be.undefined;

			await switchToKaotoAndCheckIntegrationType(KAMELET_FILE, 'Kamelet', 'kamelet:source');
		});

		it(`Check new 'Pipe' can be created`, async function () {
			const menu = await newFileButton?.open();
			await menu?.select('New Pipe...');

			input = await InputBox.create(10_000);
			await input.setText(join(WORKSPACE_FOLDER, 'pipes', 'others'));
			await input.confirm();
			await handleInputPathSelection();

			input = await InputBox.create(10_000);
			await input.setText('newPipe');
			await input.confirm();

			const newCamelRoute = await getTreeItem(driver, integrationsSection, PIPE_FILE, 120_000);
			expect(newCamelRoute).to.not.be.undefined;

			await switchToKaotoAndCheckIntegrationType(PIPE_FILE, 'Pipe', 'timer-source');
		});

		async function handleInputPathSelection(): Promise<void> {
			const nextButton = await input.findElement(By.className('monaco-button'));
			if (nextButton && (await nextButton.getText()) === 'Select') {
				/**
				 * when the provided path is not exactly formatted to the OS specificities, there is first a `Select` button and then a `Confirm`
				 * see also see https://github.com/redhat-developer/vscode-extension-tester/issues/1778
				 */
				await input.confirm();
			}
		}

		async function checkStepWithNodeLabelPresent(nodeLabel: string, timeout: number = 10_000) {
			await driver.wait(
				until.elementLocated(By.xpath(`//*[name()='g' and @data-nodelabel='${nodeLabel}']`)),
				timeout,
				`'${nodeLabel}' was not found in current topology.`,
			);
		}

		async function switchToKaotoAndCheckIntegrationType(filename: string, type: string, nodeLabel: string): Promise<void> {
			await driver.wait(
				async function () {
					return (await new EditorView().getOpenEditorTitles()).includes(filename);
				},
				30_000,
				`Kaoto editor for a new ${type} file was not opened!`,
			);

			const { kaotoWebview } = await switchToKaotoFrame(driver, true);
			await checkStepWithNodeLabelPresent(nodeLabel);
			await kaotoWebview.switchBack();
		}
	});
});
