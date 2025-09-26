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
import { ActivityBar, after, EditorView, SideBarView, ViewControl, ViewItemAction, ViewSection, VSBrowser, WebDriver } from 'vscode-extension-tester';
import { getTreeItem, killTerminal, openResourcesAndWaitForActivation, waitUntilTerminalHasText } from '../Util';

describe('Deployments View', function () {
	this.timeout(600_000); // 10 minutes

	const WORKSPACE_FOLDER = join(__dirname, '../../test Fixture with speci@l chars', 'kaoto-view');

	let driver: WebDriver;
	let kaotoViewContainer: ViewControl | undefined;
	let kaotoView: SideBarView | undefined;
	let deploymentsSection: ViewSection | undefined;
	let integrationsSection: ViewSection | undefined;

	before(async function () {
		this.timeout(180_000);
		driver = VSBrowser.instance.driver;
		await openResourcesAndWaitForActivation(WORKSPACE_FOLDER, false);

		kaotoViewContainer = await new ActivityBar().getViewControl('Kaoto');
		kaotoView = await kaotoViewContainer?.openView();
		await (await kaotoView?.getContent().getSection('Help & Feedback'))?.collapse();
		deploymentsSection = await kaotoView?.getContent().getSection('Deployments');
		integrationsSection = await kaotoView?.getContent().getSection('Integrations');
	});

	after(async function () {
		await kaotoViewContainer?.closeView();
		await new EditorView().closeAllEditors();
		await killTerminal(); // kill sample2
		await killTerminal(); // kill kaoto
	});

	const parameters = [
		{ label: 'sample2', file: 'sample2.camel.yaml', message: 'Hello World', route: 'route-1151' },
		{ label: 'kaoto', file: 'kaoto.camel.xml', message: 'Hello Camel', route: 'route-1643' },
	];

	const routeManipulations = [
		{ state: 'Stopped', button: 'Stop', allowedButtons: ['Start'] },
		{ state: 'Started', button: 'Start', allowedButtons: ['Suspend', 'Stop'] },
		{ state: 'Suspended', button: 'Suspend', allowedButtons: ['Resume', 'Stop'] },
		{ state: 'Started', button: 'Resume', allowedButtons: ['Suspend', 'Stop'] },
	];

	parameters.forEach((p) => {
		describe(`Manipulate '${p.file}' routes`, function () {
			it(`run '${p.file}' integration`, async function () {
				const item = await getTreeItem(driver, integrationsSection, p.file);
				const run = await item?.getActionButton('Run');
				await run?.click();
			});

			it(`check '${p.file}' is running`, async function () {
				const integration = await getTreeItem(driver, deploymentsSection, p.label, 30_000);
				expect(integration).to.not.be.undefined;
			});

			routeManipulations.forEach((rm) => {
				it(`click '${rm.button}' on ${p.route}`, async function () {
					const route = await getTreeItem(driver, deploymentsSection, p.route);
					expect(route).to.not.be.undefined;

					const btn = await route?.getActionButton(rm.button);
					await btn?.click();

					await waitUntilTerminalHasText(driver, [`${rm.state} ${p.route}`], 1_000, 20_000);
					await waitUntilRouteHasState(rm.state);

					const buttons = (await route?.getActionButtons()) as ViewItemAction[];
					const buttonsLabels = await Promise.all(buttons.map((btn) => btn.getLabel()));
					expect(buttonsLabels).to.has.members(rm.allowedButtons);
				});
			});
		});

		async function waitUntilRouteHasState(state: string, interval = 500, timeout = 10_000): Promise<void> {
			await driver.wait(
				async function () {
					try {
						const route = await getTreeItem(driver, deploymentsSection, p.route);
						const description = await route?.getDescription();
						return description?.startsWith(state);
					} catch (err) {
						return false;
					}
				},
				timeout,
				`Timeout: route is not in an expected state - "${state}"`,
				interval,
			);
		}
	});
});
