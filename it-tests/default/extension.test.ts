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
import { NotificationsCenter, NotificationType, Workbench } from 'vscode-extension-tester';
import { openResourcesAndWaitForActivation } from '../Util';
import { join } from 'path';
import { expect } from 'chai';
import { waitUntil } from 'async-wait-until';

describe('Extension', function () {
	this.timeout(90_000);

	const WORKSPACE_FOLDER = join(__dirname, '../../test Fixture with speci@l chars');

	let notificationCenter: NotificationsCenter;

	before(async function () {
		this.timeout(60_000);
		await openResourcesAndWaitForActivation(WORKSPACE_FOLDER);

		notificationCenter = await new Workbench().openNotificationsCenter();
		await notificationCenter.getDriver().wait(async () => {
			// expect to have at least two notifications, in fact would better to check both are already available
			return (await notificationCenter.getNotifications(NotificationType.Info)).length > 1;
		});
	});

	it(`Check 'XML' extension recommendation exists`, async function () {
		await notificationAvailable(notificationCenter, 'XML Language Support by Red Hat');
		const notifications = await notificationCenter.getNotifications(NotificationType.Info);
		const xml = notifications.find(async (n) => (await n.getText()).includes('XML Language Support by Red Hat'));
		expect(xml).to.not.be.undefined;
		try {
			await xml?.takeAction('Never'); // click 'Never' to avoid interruption with other tests
		} catch {
			const notifications = await notificationCenter.getNotifications(NotificationType.Info);
			const xml = notifications.find(async (n) => (await n.getText()).includes('XML Language Support by Red Hat'));
			await xml?.takeAction('Never');
		}
	});

	it(`Check 'YAML' extension recommendation exists`, async function () {
		await notificationAvailable(notificationCenter, 'YAML Language Support by Red Hat');
		const notifications = await notificationCenter.getNotifications(NotificationType.Info);
		const yaml = notifications.find(async (n) => (await n.getText()).includes('YAML Language Support by Red Hat'));
		expect(yaml).to.not.be.undefined;
		try {
			await yaml?.takeAction('Never'); // click 'Never' to avoid interruption with other tests
		} catch {
			const notifications = await notificationCenter.getNotifications(NotificationType.Info);
			const yaml = notifications.find(async (n) => (await n.getText()).includes('YAML Language Support by Red Hat'));
			expect(yaml).to.not.be.undefined;
			await yaml?.takeAction('Never');
		}
	});
});
async function notificationAvailable(notificationCenter: NotificationsCenter, notificationText: string) {
	await waitUntil(async () => {
		const notifications = await notificationCenter.getNotifications(NotificationType.Info);
		const notificationWithText = notifications.find(async (n) => (await n.getText()).includes(notificationText));
		return notificationWithText !== undefined;
	});
}
