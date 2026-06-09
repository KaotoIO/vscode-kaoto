/**
 * Copyright 2026 Red Hat, Inc. and/or its affiliates.
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
import { By, until, VSBrowser, WebDriver, WebView } from 'vscode-extension-tester';
import * as path from 'path';
import * as fs from 'fs-extra';
import { closeEditor, openAndSwitchToKaotoFrame, openResourcesAndWaitForActivation } from './Util';

const ROUTE_WITH_DIRECT = `- route:
    id: camelroute51
    from:
      id: directID
      uri: direct:start
      parameters: {}
      steps:
        - log:
            message: externally changed message
`;

describe('External file change reloads Kaoto editor', function () {
	this.timeout(60_000);

	const workspaceFolder = path.join(__dirname, '../test Fixture with speci@l chars');
	const testFileName = 'external-change-test.camel.yaml';
	const testFile = path.join(workspaceFolder, testFileName);

	let driver: WebDriver;
	let globalKaotoWebView: WebView | undefined;

	before(async function () {
		await openResourcesAndWaitForActivation(workspaceFolder);
		fs.copySync(path.join(workspaceFolder, 'my.camel.yaml'), testFile);
		driver = VSBrowser.instance.driver;
	});

	after(function () {
		if (fs.existsSync(testFile)) {
			fs.rmSync(testFile);
		}
	});

	afterEach(async function () {
		if (globalKaotoWebView !== undefined) {
			try {
				await globalKaotoWebView.switchBack();
			} catch {
				// editor may already be closed, continue
			}
			globalKaotoWebView = undefined;
		}
		await closeEditor(testFileName, false);
	});

	it('reloads the diagram when the file is changed by an external process', async function () {
		const { kaotoWebview } = await openAndSwitchToKaotoFrame(workspaceFolder, testFileName, driver, true);
		globalKaotoWebView = kaotoWebview;

		// Verify initial state: timer component is present
		await driver.wait(
			until.elementLocated(By.xpath(`//*[name()='g' and starts-with(@data-testid,'custom-node__timer') or @data-nodelabel='timer']`)),
			10_000,
			'Initial timer node was not found in the Kaoto diagram',
		);

		await kaotoWebview.switchBack();

		// Simulate an external process writing to the file (e.g. git pull, AI edit)
		fs.writeFileSync(testFile, ROUTE_WITH_DIRECT, 'utf-8');

		await kaotoWebview.switchToFrame();

		// The editor should automatically reload and show the new direct component
		await driver.wait(
			until.elementLocated(By.xpath(`//*[name()='g' and starts-with(@data-testid,'custom-node__direct') or @data-nodelabel='direct']`)),
			15_000,
			'Kaoto editor did not reload after external file change',
		);

		await kaotoWebview.switchBack();
	});
});
