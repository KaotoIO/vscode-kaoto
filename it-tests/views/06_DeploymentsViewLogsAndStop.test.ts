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
import {
	ActivityBar,
	after,
	before,
	BottomBarPanel,
	EditorView,
	SideBarView,
	TreeItem,
	ViewControl,
	ViewSection,
	VSBrowser,
	WebDriver,
} from 'vscode-extension-tester';
import { getTreeItem, killTerminal, waitUntilTerminalHasText } from '../Util';

describe('Deployments View', function () {
	this.timeout(600_000); // 10 minutes

	const WORKSPACE_FOLDER = join(__dirname, '../../test Fixture with speci@l chars', 'kaoto-view');

	let driver: WebDriver;
	let kaotoViewContainer: ViewControl | undefined;
	let kaotoView: SideBarView | undefined;
	let deploymentsSection: ViewSection | undefined;
	let integrationsSection: ViewSection | undefined;

	before(async function () {
		driver = VSBrowser.instance.driver;
		await VSBrowser.instance.openResources(WORKSPACE_FOLDER);
		await VSBrowser.instance.waitForWorkbench();

		kaotoViewContainer = await new ActivityBar().getViewControl('Kaoto');
		kaotoView = await kaotoViewContainer?.openView();
		deploymentsSection = await kaotoView?.getContent().getSection('Deployments');
		integrationsSection = await kaotoView?.getContent().getSection('Integrations');
	});

	after(async function () {
		await kaotoViewContainer?.closeView();
		await new EditorView().closeAllEditors();
		await killTerminal();
	});

	const parameters = [
		{ label: 'sample2', file: 'sample2.camel.yaml', message: 'Hello World' },
		{ label: 'kaoto', file: 'kaoto.camel.xml', message: 'Hello Camel' },
	];

	parameters.forEach((p) => {
		it(`run '${p.file}' integration`, async function () {
			const item = await getTreeItem(driver, integrationsSection, p.file);
			const run = await item?.getActionButton('Run');
			await run?.click();
		});

		it(`check '${p.file}' is running`, async function () {
			const item1 = await getTreeItem(driver, deploymentsSection, p.label, 30_000);
			expect(item1).to.not.be.undefined;
		});
	});

	it(`hide terminal`, async function () {
		await new BottomBarPanel().toggle(false);
	});

	parameters.forEach((p) => {
		it(`show logs for '${p.file}'`, async function () {
			const item = await getTreeItem(driver, deploymentsSection, p.label);
			const logs = await item?.getActionButton('Follow Logs');
			await logs?.click();

			await waitUntilTerminalHasText(driver, [p.message], 2_000, 30_000);
		});

		it(`stop running '${p.file}'`, async function () {
			const item = await getTreeItem(driver, deploymentsSection, p.label);
			const stop = await item?.getActionButton('Stop');
			await stop?.click();
			await waitUntilTerminalHasText(driver, ['Routes stopped', 'shutdown in'], 2_000, 30_000);
		});

		it(`check '${p.file}' is not running`, async function () {
			const integrationStopped = await driver.wait(
				async function () {
					try {
						const item = (await deploymentsSection?.findItem(p.label)) as TreeItem;
						if (item) {
							return false;
						} else {
							return true;
						}
					} catch (error) {
						return true;
					}
				},
				5_000,
				`${p.label} is still found within ${await deploymentsSection?.getTitle()} view!`,
			);
			expect(integrationStopped).to.be.true;
		});
	});
});
