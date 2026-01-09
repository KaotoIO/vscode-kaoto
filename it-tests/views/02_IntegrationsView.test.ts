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
import { ActivityBar, EditorView, SideBarView, TreeItem, ViewControl, ViewSection } from 'vscode-extension-tester';
import {
	checkTopologyLoaded,
	collapseItemsInsideIntegrationsView,
	expandFolderItemsInIntegrationsView,
	openResourcesAndWaitForActivation,
	switchToKaotoFrame,
} from '../Util';

describe('Integrations View', function () {
	this.timeout(60_000);

	const WORKSPACE_FOLDER = join(__dirname, '../../test Fixture with speci@l chars', 'kaoto-view');

	let kaotoViewContainer: ViewControl | undefined;
	let kaotoView: SideBarView | undefined;
	let integrationsSection: ViewSection | undefined;
	let deploymentsSection: ViewSection | undefined;
	let items: TreeItem[] | undefined;
	let labels: string[];

	before(async function () {
		await openResourcesAndWaitForActivation(WORKSPACE_FOLDER);

		kaotoViewContainer = await new ActivityBar().getViewControl('Kaoto');
		kaotoView = await kaotoViewContainer?.openView();
		await (await kaotoView?.getContent().getSection('Help & Feedback'))?.collapse();
		deploymentsSection = await kaotoView?.getContent().getSection('Deployments');
		await deploymentsSection?.collapse();
		integrationsSection = await kaotoView?.getContent().getSection('Integrations');

		// expand folders
		await expandFolderItemsInIntegrationsView(integrationsSection, 'kamelets', 'pipes', 'others');

		items = await integrationsSection?.getDriver().wait(
			async () => {
				const items = await integrationsSection?.getVisibleItems();
				if (items && items?.length > 0) {
					return items as TreeItem[];
				} else {
					return undefined;
				}
			},
			5_000,
			'Integrations section items were not loaded properly',
			500,
		);

		if (items) {
			labels = await Promise.all(items.map((item) => item.getLabel()));
		}
	});

	after(async function () {
		await collapseItemsInsideIntegrationsView(integrationsSection);
		await deploymentsSection?.expand();
		await kaotoViewContainer?.closeView();
		await new EditorView().closeAllEditors();
	});

	it('items are displayed', async function () {
		expect(labels).to.not.be.empty;
	});

	it('camel routes (*.camel.xml) loaded', async function () {
		const xmlRoutes = labels.filter((label) => label.includes('.camel.xml'));

		expect(xmlRoutes).to.not.be.empty;
		expect(xmlRoutes.length).to.be.equal(2);
		expect(xmlRoutes).to.include.members(['sample.camel.xml', 'kaoto.camel.xml']);
	});

	it('camel routes (*.camel.yaml) loaded', async function () {
		const yamlRoutes = labels.filter((label) => label.includes('.camel.yaml'));

		expect(yamlRoutes).to.not.be.empty;
		expect(yamlRoutes.length).to.be.equal(3);
		expect(yamlRoutes).to.include.members(['sample1.camel.yaml', 'sample2.camel.yaml', 'sample3.camel.yaml']);
	});

	it('pipes (*.pipe.yaml | *-pipe.yaml) loaded', async function () {
		const pipes = labels.filter((label) => label.includes('.pipe.yaml') || label.includes('-pipe.yaml'));

		expect(pipes).to.not.be.empty;
		expect(pipes.length).to.be.equal(2);
		expect(pipes).to.include.members(['pipe1.pipe.yaml', 'pipe2-pipe.yaml']);
	});

	it('kamelets (*.kamelet.yaml) loaded', async function () {
		const kamelets = labels.filter((label) => label.includes('.kamelet.yaml'));

		expect(kamelets).to.not.be.empty;
		expect(kamelets.length).to.be.equal(1);
		expect(kamelets).to.contain('kam1.kamelet.yaml');
	});

	it('routes are parsed and displayed', async function () {
		const routes = labels.filter((label) => label.startsWith('route-'));
		expect(routes).to.not.be.empty;
		expect(routes.length).to.be.equal(10);

		const route = (await integrationsSection?.findItem('route-2700')) as TreeItem;
		expect(route).to.not.be.undefined;
		expect(await route.getLabel()).to.be.equal('route-2700');
	});

	it('click on file opens Kaoto editor', async function () {
		const sample2 = (await integrationsSection?.findItem('sample2.camel.yaml')) as TreeItem;
		await sample2.click();

		const driver = sample2.getDriver();
		const { kaotoWebview } = await switchToKaotoFrame(driver, true);
		await checkTopologyLoaded(driver);

		await kaotoWebview.switchBack();
	});
});
