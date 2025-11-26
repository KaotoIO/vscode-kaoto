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
import { ActivityBar, EditorView, InputBox, SideBarView, ViewControl, ViewSection, VSBrowser, WebDriver, Workbench } from 'vscode-extension-tester';
import { collapseItemsInsideIntegrationsView, getViewActionButton, killTerminal, openResourcesAndWaitForActivation, waitUntilTerminalHasText } from '../Util';
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

		const collapseItems = await getViewActionButton(kaotoViewContainer, integrationsSection, 'Collapse All');
		await collapseItems?.click();
	});

	after(async function () {
		await collapseItemsInsideIntegrationsView(integrationsSection);
		await kaotoViewContainer?.closeView();
		await new EditorView().closeAllEditors();
	});

	describe(`Check 'Run: Workspace' button functionality`, function () {
		after(async function () {
			await killTerminal();
		});

		it('button is available', async function () {
			const button = await getViewActionButton(kaotoViewContainer, integrationsSection, 'Run: Workspace');
			expect(button).to.not.be.undefined;
		});

		it(`click button`, async function () {
			const button = await getViewActionButton(kaotoViewContainer, integrationsSection, 'Run: Workspace');
			await button?.click();
		});

		it(`check all workspace routes are running`, async function () {
			await waitUntilTerminalHasText(driver, ['Routes startup', 'Hello Root Route', 'Hello Route A', 'Hello Route B', 'Hello Route BB'], 4_000, 180_000);
		});
	});

	describe(`Check 'Run: All Workspaces' button functionality`, function () {
		const WORKSPACE_FILE = join(__dirname, '../../test Fixture with speci@l chars', 'kaoto-view', 'routes.code-workspace');

		before(async function () {
			await new Workbench().executeCommand('File: Open Workspace from File...');
			const input = await InputBox.create(10_000);
			await input.setText(WORKSPACE_FILE);
			await input.confirm();

			await driver.sleep(1_000);
			await VSBrowser.instance.waitForWorkbench();

			kaotoViewContainer = await new ActivityBar().getViewControl('Kaoto');
			kaotoView = await kaotoViewContainer?.openView();
			integrationsSection = await kaotoView?.getContent().getSection('Integrations');
		});

		it('button is available', async function () {
			const button = await getViewActionButton(kaotoViewContainer, integrationsSection, 'Run: All Workspaces');
			expect(button).to.not.be.undefined;
		});

		it(`click button`, async function () {
			const button = await getViewActionButton(kaotoViewContainer, integrationsSection, 'Run: All Workspaces');
			await button?.click();
		});

		const expectedMessages = [
			{ workspace: 'folderB', messages: ['Hello Route B', 'Hello Route BB'] },
			{ workspace: 'folderA', messages: ['Hello Route A'] },
		];

		for (const { workspace, messages } of expectedMessages) {
			it(`check ${workspace} workspace routes are running`, async function () {
				await waitUntilTerminalHasText(driver, ['Routes startup', ...messages], 4_000, 180_000);
				await killTerminal(); // terminate the running workspace integrations
			});
		}
	});
});
