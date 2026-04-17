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
import { after, EditorView, TreeItem, ViewControl, ViewItemAction, ViewSection, VSBrowser, WebDriver } from 'vscode-extension-tester';
import {
	collapseItemsInsideTreeStructuredView,
	expandViews,
	getKaotoViewControl,
	getTreeItem,
	getTreeItemActionButton,
	killTerminal,
	openResourcesAndWaitForActivation,
	waitUntilTerminalHasText,
} from '../Util';

describe('Deployments View', function () {
	this.timeout(600_000); // 10 minutes

	const WORKSPACE_FOLDER = join(__dirname, '../../test Fixture with speci@l chars', 'kaoto-view');

	let driver: WebDriver;
	let kaotoViewContainer: ViewControl | undefined;
	let deploymentsSection: ViewSection | undefined;
	let integrationsSection: ViewSection | undefined;

	before(async function () {
		this.timeout(180_000);
		driver = VSBrowser.instance.driver;
		await openResourcesAndWaitForActivation(WORKSPACE_FOLDER, false);

		const control = await getKaotoViewControl();
		kaotoViewContainer = control.kaotoViewContainer;
		deploymentsSection = await control.kaotoView?.getContent().getSection('Deployments');
		integrationsSection = await control.kaotoView?.getContent().getSection('Integrations');
		await expandViews(control.kaotoView, 'Deployments', 'Integrations');

		await collapseItemsInsideTreeStructuredView(integrationsSection);
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
				expect(item).to.not.be.undefined;
				const run = await getTreeItemActionButton(kaotoViewContainer, item as TreeItem, 'Run');
				await run?.click();
			});

			it(`check '${p.file}' is running`, async function () {
				const integration = await getTreeItem(driver, deploymentsSection, p.label, 30_000);
				expect(integration).to.not.be.undefined;
			});

			routeManipulations.forEach((rm) => {
				it(`click '${rm.button}' on ${p.route}`, async function () {
					await clickRouteActionButton(rm.button);

					await waitUntilTerminalHasText(driver, [`${rm.state} ${p.route}`], 1_000, 20_000);
					await waitUntilRouteHasState(rm.state);
					await waitUntilRouteHasButtons(rm.allowedButtons);
				});
			});
		});

		async function clickRouteActionButton(action: string, timeout = 15_000): Promise<void> {
			let clicked = false;
			await driver.wait(
				async () => {
					try {
						const route = await getTreeItem(driver, deploymentsSection, p.route, 5_000);
						expect(route).to.not.be.undefined;

						await route?.click();
						const btn = await getTreeItemActionButton(kaotoViewContainer, route as TreeItem, action, 2_000);
						expect(btn, `'${action}' action button should be available for ${p.route}`).to.not.be.undefined;

						await btn?.click();
						clicked = true;
						return true;
					} catch (err) {
						return false;
					}
				},
				timeout,
				`Timeout: failed to click '${action}' on ${p.route}`,
				500,
			);

			expect(clicked, `Failed to click '${action}' on ${p.route}`).to.be.true;
			await driver.sleep(1_000);
		}

		async function waitUntilRouteHasState(state: string, interval = 500, timeout = 15_000): Promise<void> {
			await driver.wait(
				async function () {
					try {
						const route = await getTreeItem(driver, deploymentsSection, p.route, 5_000);
						expect(route).to.not.be.undefined;
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

		async function waitUntilRouteHasButtons(expectedButtons: string[], interval = 500, timeout = 15_000): Promise<void> {
			let buttonsLabels: string[] = [];
			await driver.wait(
				async function () {
					try {
						const route = await getTreeItem(driver, deploymentsSection, p.route, 5_000);
						expect(route).to.not.be.undefined;

						await route?.click();
						const buttons = (await route?.getActionButtons()) as ViewItemAction[];
						buttonsLabels = await Promise.all(buttons.map((btn) => btn.getLabel()));
						return expectedButtons.every((button) => buttonsLabels.includes(button)) && buttonsLabels.length === expectedButtons.length;
					} catch (err) {
						buttonsLabels = [];
						return false;
					}
				},
				timeout,
				`Timeout: route action buttons ${expectedButtons.join(', ')} were not visible. Actual: ${buttonsLabels.join(', ')}`,
				interval,
			);

			expect(buttonsLabels).to.have.members(expectedButtons);
		}
	});
});
