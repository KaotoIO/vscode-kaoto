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
import { ActivityBar, after, before, EditorView, SideBarView, ViewControl, ViewSection, VSBrowser, WebDriver } from 'vscode-extension-tester';
import { getTreeItem, killTerminal, waitUntilTerminalHasText } from '../Util';

/**
 * Note:
 * - OC login needs to be done before executing this test for deployment into OpenShift
 * - Linux Only for a Deploy part
 */
describe('Integrations View', function () {
	this.timeout(1200_000); // 20 minutes

	const WORKSPACE_FOLDER = join(__dirname, '../../test Fixture with speci@l chars', 'kaoto-view');

	let driver: WebDriver;
	let kaotoViewContainer: ViewControl | undefined;
	let kaotoView: SideBarView | undefined;
	let integrationsSection: ViewSection | undefined;

	before(async function () {
		driver = VSBrowser.instance.driver;
		await VSBrowser.instance.openResources(WORKSPACE_FOLDER);
		await VSBrowser.instance.waitForWorkbench();

		kaotoViewContainer = await new ActivityBar().getViewControl('Kaoto');
		kaotoView = await kaotoViewContainer?.openView();
		integrationsSection = await kaotoView?.getContent().getSection('Integrations');
	});

	after(async function () {
		await kaotoViewContainer?.closeView();
		await new EditorView().closeAllEditors();
	});

	const buttons = [
		{ label: 'Run', interval: 4_000, timeout: 180_000 },
		{ label: 'Deploy', interval: 10_000, timeout: 900_000 },
	];

	buttons.forEach((btn) => {
		it(`'${btn.label}' button is available`, async function () {
			const item = await getTreeItem(driver, integrationsSection, 'pipe1.pipe.yaml');
			const button = await item?.getActionButton(btn.label);
			expect(button).to.not.be.undefined;
		});
	});

	buttons.forEach((btn) => {
		describe(`Click '${btn.label}' button`, function () {
			after(async function () {
				await killTerminal();
			});

			it(`check 'sample2.camel.yaml' is running`, async function () {
				if (btn.label === 'Deploy' && process.platform !== 'linux') {
					this.skip();
				}
				const item = await getTreeItem(driver, integrationsSection, 'sample2.camel.yaml');
				const button = await item?.getActionButton(btn.label);
				await button?.click();

				await waitUntilTerminalHasText(driver, ['Routes startup', 'Hello World'], btn.interval, btn.timeout);
			});
		});
	});
});
