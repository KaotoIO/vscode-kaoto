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
import { join, sep } from 'path';
import { ActivityBar, EditorView, SideBarView, TreeItem, ViewControl, ViewSection, VSBrowser } from 'vscode-extension-tester';
import { checkTopologyLoaded, switchToKaotoFrame } from '../Util';

describe('Integrations View', function () {
	this.timeout(60_000);

	const WORKSPACE_FOLDER = join(__dirname, '../../test Fixture with speci@l chars/kaoto-view');

	let kaotoViewContainer: ViewControl | undefined;
	let kaotoView: SideBarView | undefined;
	let integrationsSection: ViewSection | undefined;
	let items: TreeItem[];
	let labels: string[];

	before(async function () {
		await VSBrowser.instance.openResources(WORKSPACE_FOLDER);

		kaotoViewContainer = await new ActivityBar().getViewControl('Kaoto');
		kaotoView = await kaotoViewContainer?.openView();
		integrationsSection = await kaotoView?.getContent().getSection('Integrations');

		items = (await integrationsSection?.getVisibleItems()) as TreeItem[];
		labels = await Promise.all(items.map((item) => item.getLabel()));
	});

	after(async function () {
		await kaotoViewContainer?.closeView();
		await new EditorView().closeAllEditors();
	});

	it('items are displayed', async function () {
		expect(labels).to.not.be.empty;
	});

	it('integration (*.camel.yaml) loaded', async function () {
		const integrations = labels.filter((label) => label.includes('.camel.yaml'));

		expect(integrations).to.not.be.empty;
		expect(integrations.length).to.be.equal(3);
		expect(integrations).to.include.members(['sample1.camel.yaml', 'sample2.camel.yaml', 'sample3.camel.yaml']);
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

	it('items relative folder path is displayed', async function () {
		const rootLevelFolder = (await integrationsSection?.findItem('sample1.camel.yaml')) as TreeItem;
		expect(await rootLevelFolder.getDescription()).to.be.equal('.');

		const firstLevelFolder = (await integrationsSection?.findItem('kam1.kamelet.yaml')) as TreeItem;
		expect(await firstLevelFolder.getDescription()).to.be.equal('kamelets');

		const secondLevelFolder = (await integrationsSection?.findItem('pipe2-pipe.yaml')) as TreeItem;
		expect(await secondLevelFolder.getDescription()).to.be.equal(`pipes${sep}others`);
	});

	it('routes are parsed and displayed', async function () {
		const routes = labels.filter((label) => label.startsWith('route'));
		expect(routes).to.not.be.empty;
		expect(routes.length).to.be.equal(5);

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
