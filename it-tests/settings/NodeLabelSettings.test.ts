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
import { ActivityBar, after, By, ComboSetting, VSBrowser, WebDriver, WebView, Workbench } from 'vscode-extension-tester';
import { checkTopologyLoaded, closeEditor, openAndSwitchToKaotoFrame, resetUserSettings } from '../Util';
import { join } from 'path';
import { expect } from 'chai';

describe('User Settings', function () {
	this.timeout(90_000);

	const WORKSPACE_FOLDER = join(__dirname, '../../test Fixture with speci@l chars');
	const LABEL_SETTINGS_ID = 'kaoto.nodeLabel';

	let driver: WebDriver;
	let kaotoWebview: WebView;

	const locators = {
		TimerComponent: {
			timer_2_3: `g[data-id^='timer'][data-kind='node']`,
			timer_2_4: `g[data-nodelabel='timerID']`,
			label: `.custom-node__label`,
		},
	};

	before(async function () {
		this.timeout(60_000);
		driver = VSBrowser.instance.driver;

		// provide the Node Label using Settings UI editor
		const settings = await new Workbench().openSettings();
		const textSetting = await driver.wait(async () => {
			return (await settings.findSetting('Node Label', 'Kaoto')) as ComboSetting;
		});
		await textSetting.setValue('id');
		await driver.sleep(1_000); // stabilize tests which are sometimes failing on macOS CI
		await closeEditor('Settings', true);

		// close sidebar
		await (await new ActivityBar().getViewControl('Explorer'))?.closeView();

		// open the integration file using Kaoto editor
		kaotoWebview = (await openAndSwitchToKaotoFrame(WORKSPACE_FOLDER, 'my.camel.yaml', driver, true)).kaotoWebview;
		await checkTopologyLoaded(driver);
	});

	after(async function () {
		if (kaotoWebview !== undefined) {
			try {
				await kaotoWebview.switchBack();
			} catch {
				// probably test not failed in Kaoto UI, just continue
			}
		}
		resetUserSettings(LABEL_SETTINGS_ID);
		// the editor in this step needs to be closed using command palette
		// because in some cases, specially on Windows, there was hover displayed which was blocking the editor close button
		await new Workbench().executeCommand('View: Close Editor');
	});

	it(`Check 'id' Node Label is used instead of default 'description'`, async function () {
		this.timeout(60_000);
		let timer;
		try {
			timer = await driver.findElement(By.css(`${locators.TimerComponent.timer_2_3} ${locators.TimerComponent.label}`));
		} catch {
			timer = await driver.findElement(By.css(`${locators.TimerComponent.timer_2_4} ${locators.TimerComponent.label}`));
		}
		const label = await timer.getText();

		expect(label.split('\n')).to.contains('timerID');
	});
});
