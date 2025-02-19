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
import { expect } from "chai";
import { join } from "path";
import { ActivityBar, SideBarView, ViewControl, ViewItem, ViewSection, VSBrowser } from "vscode-extension-tester";

describe('Kaoto View Container', function () {
    this.timeout(30_000)

    const WORKSPACE_FOLDER = join(__dirname, '../../test Fixture with speci@l chars/kaoto-view');

    let kaotoViewContainer: ViewControl | undefined;
    let kaotoView: SideBarView | undefined;

    before(async function () {
        await VSBrowser.instance.openResources(WORKSPACE_FOLDER);
    });

    after(async function () {
        await kaotoViewContainer?.closeView();
    });

    it('is available in Activity Bar', async function () {
        const bar = new ActivityBar();
        kaotoViewContainer = await bar.getViewControl('Kaoto');
        expect(kaotoViewContainer).to.not.be.undefined;

        const title = await kaotoViewContainer?.getTitle();
        expect(title).to.equal('Kaoto');
    });

    it('can be activated', async function () {
        kaotoView = await kaotoViewContainer?.openView();
        expect(kaotoView).to.not.be.undefined;
    });

    describe('Help & Feedback view', function () {

        let helpFeedbackSection: ViewSection | undefined;

        it('is present', async function () {
            helpFeedbackSection = await kaotoView?.getContent().getSection('Help & Feedback');
            expect(helpFeedbackSection).to.not.be.undefined;
        });

        it('content check', async function () {
            const items = await helpFeedbackSection?.getVisibleItems() as ViewItem[];
            const labels = await Promise.all(items.map((item) => item.getText()));
            expect(labels).to.not.be.empty;
        });
    });

    describe('Integrations view', function () {

        let integrationsSection: ViewSection | undefined;

        it('is present', async function () {
            integrationsSection = await kaotoView?.getContent().getSection('Integrations');
            expect(integrationsSection).to.not.be.undefined;
        });
    });
});
