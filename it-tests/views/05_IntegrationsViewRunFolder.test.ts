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
import { join } from 'path';
import { ActivityBar, EditorView, SideBarView, ViewControl, ViewSection, VSBrowser, WebDriver } from 'vscode-extension-tester';
import {
	collapseItemsInsideIntegrationsView,
	getTreeItem,
	getViewActionButton,
	killTerminal,
	openResourcesAndWaitForActivation,
	waitUntilTerminalHasText,
} from '../Util';
import { expect } from 'chai';

describe('Integrations View', function () {
	this.timeout(600_000); // 10 minutes

	const WORKSPACE_FOLDER = join(__dirname, '../../test Fixture with speci@l chars', 'kaoto-view', 'routes');

	let driver: WebDriver;
	let kaotoViewContainer: ViewControl | undefined;
	let kaotoView: SideBarView | undefined;
	let integrationsSection: ViewSection | undefined;

	before(async function () {
		driver = VSBrowser.instance.driver;
		await openResourcesAndWaitForActivation(WORKSPACE_FOLDER, false);

		kaotoViewContainer = await new ActivityBar().getViewControl('Kaoto');
		kaotoView = await kaotoViewContainer?.openView();
		await (await kaotoView?.getContent().getSection('Help & Feedback'))?.collapse();
		integrationsSection = await kaotoView?.getContent().getSection('Integrations');
		const collapseItems = await getViewActionButton(integrationsSection, 'Collapse All');
		await collapseItems?.click();
	});

	after(async function () {
		await collapseItemsInsideIntegrationsView(integrationsSection);
		await kaotoViewContainer?.closeView();
		await new EditorView().closeAllEditors();
	});

	describe(`Check 'Run: Folder' button functionality`, function () {
		after(async function () {
			await killTerminal();
		});

		it('button is available', async function () {
			const item = await getTreeItem(driver, integrationsSection, 'folderB');
			const button = await item?.getActionButton('Run: Folder');
			expect(button).to.not.be.undefined;
		});

		it(`click 'folderB' button`, async function () {
			const item = await getTreeItem(driver, integrationsSection, 'folderB');
			const button = await item?.getActionButton('Run: Folder');
			await button?.click();
		});

		it(`check 'folderB' routes are running`, async function () {
			await waitUntilTerminalHasText(driver, ['Routes startup', 'Hello Route B', 'Hello Route BB'], 4_000, 180_000);
		});
	});
});
