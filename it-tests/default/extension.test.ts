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
import { Notification, NotificationsCenter, NotificationType, Workbench } from 'vscode-extension-tester';
import { openResourcesAndWaitForActivation } from '../Util';
import { join } from 'path';
import { expect } from 'chai';

describe('Extension', function () {
	this.timeout(90_000);

	const WORKSPACE_FOLDER = join(__dirname, '../../test Fixture with speci@l chars');

	let notificationCenter: NotificationsCenter;
	let notifications: Notification[];

	before(async function () {
		this.timeout(60_000);
		await openResourcesAndWaitForActivation(WORKSPACE_FOLDER);

		notificationCenter = await new Workbench().openNotificationsCenter();
		await notificationCenter.getDriver().wait(async () => {
			return (await notificationCenter.getNotifications(NotificationType.Info)).length > 0;
		});
	});

	it(`Check 'XML' extension recommendation exists`, async function () {
		notifications = await notificationCenter.getNotifications(NotificationType.Info);
		const xml = notifications.find(async (n) => (await n.getText()).includes('XML Language Support by Red Hat'));
		expect(xml).to.not.be.undefined;
		await xml?.takeAction('Never'); // click 'Never' to avoid interruption with other tests
	});

	it(`Check 'YAML' extension recommendation exists`, async function () {
		notifications = await notificationCenter.getNotifications(NotificationType.Info);
		const yaml = notifications.find(async (n) => (await n.getText()).includes('YAML Language Support by Red Hat'));
		expect(yaml).to.not.be.undefined;
		await yaml?.takeAction('Never'); // click 'Never' to avoid interruption with other tests
	});
});
