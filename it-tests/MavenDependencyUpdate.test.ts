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
import * as path from 'path';
import { checkTopologyLoaded, openAndSwitchToKaotoFrame, openResourcesAndWaitForActivation, workaroundToRedrawContextualMenu } from './Util';
import { By, EditorView, until, VSBrowser, WebDriver, Workbench, NotificationType, WebView, TextEditor } from 'vscode-extension-tester';
import { assert } from 'chai';
import * as fs from 'fs';

describe('Maven dependency update pom.xml on save test', function () {
	this.timeout(180_000);

	const workspaceFolder = path.join(__dirname, '../test Fixture with speci@l chars', 'camel-maven-quarkus-project');

	let driver: WebDriver;
	let kaotoWebview: WebView;

	before(async function () {
		driver = VSBrowser.instance.driver;
		await openResourcesAndWaitForActivation(workspaceFolder);

		await new Workbench().openNotificationsCenter().then(async (notificationsCenter) => await notificationsCenter.clearAllNotifications());

		// make pom.xml dirty
		await VSBrowser.instance.openResources(path.join(workspaceFolder, 'pom.xml'), async () => {
			await driver.wait(
				async () => {
					const editorTitles = await new EditorView().getOpenEditorTitles();
					return editorTitles.includes('pom.xml');
				},
				5000,
				'Pom.xml is not opened',
			);
		});
		const pomEditor = (await new EditorView().openEditor('pom.xml')) as TextEditor;
		await pomEditor.typeTextAt(1, 20, ' ');
	});

	after(async function () {
		await deleteSqlComponentStep();
		await new EditorView().closeAllEditors();
		removeSqlDependencyFromPomXml();
	});

	it('should invoke the update of the Maven dependencies when a step is added', async function () {
		kaotoWebview = (
			await openAndSwitchToKaotoFrame(path.join(workspaceFolder, 'src/main/resources/camel'), 'my-camel-quarkus-route.camel.yaml', driver, true)
		).kaotoWebview;

		await checkTopologyLoaded(driver);
		await addSqlComponentStep();

		// save editor
		await kaotoWebview.switchBack();
		await new Workbench().executeCommand('File: Save');

		await waitForNotification(
			true,
			'The pom.xml file has unsaved changes. Please save it before updating Camel dependencies.',
			'Timeout waiting for the notification of the unsaved changes in pom.xml',
			5000,
			100,
			NotificationType.Warning,
		);

		const notificationsCenter = await new Workbench().openNotificationsCenter();
		const notifications = await notificationsCenter.getNotifications(NotificationType.Warning);
		const camelDependenciesUpdateNotification = notifications.find(async (notification) =>
			(await notification.getMessage()).includes('The pom.xml file has unsaved changes. Please save it before updating Camel dependencies.'),
		);
		await camelDependenciesUpdateNotification?.takeAction('Save and Continue');

		// wait till the notification is shown
		await waitForNotification(
			true,
			'Updating Camel dependencies in pom.xml',
			'Timeout waiting for the notification of the Maven dependency update',
			5000,
			100,
		);

		// wait till dependency update finishes
		await waitForNotification(
			false,
			'Updating Camel dependencies in pom.xml',
			'Timeout waiting for the notification of the Maven dependency update',
			40_000,
			1_000,
		);
	});

	it('pom.xml should be updated with the new dependencies', async function () {
		const pomXml = fs.readFileSync(path.join(workspaceFolder, 'pom.xml'), 'utf8');
		assert.include(pomXml, '<artifactId>camel-quarkus-sql</artifactId>');
	});

	/**
	 * Remove dependencies added for SQL component from the pom.xml file
	 */
	function removeSqlDependencyFromPomXml() {
		const pomXml = fs.readFileSync(path.join(workspaceFolder, 'pom.xml'), 'utf8');
		// Remove the entire <dependency> block for camel-quarkus-sql
		const dependencyRegexSql =
			/<dependency>\s*<groupId>org\.apache\.camel\.quarkus<\/groupId>\s*<artifactId>camel-quarkus-sql<\/artifactId>[\s\S]*?<\/dependency>\s*/g;
		const dependencyRegexYamlDsl =
			/<dependency>\s*<groupId>org\.apache\.camel\.quarkus<\/groupId>\s*<artifactId>camel-quarkus-yaml-dsl<\/artifactId>[\s\S]*?<\/dependency>\s*/g;

		let updatedPomXml = pomXml.replace(dependencyRegexSql, '');
		updatedPomXml = updatedPomXml.replace(dependencyRegexYamlDsl, '');

		fs.writeFileSync(path.join(workspaceFolder, 'pom.xml'), updatedPomXml);
	}

	/**
	 * Wait for a notification to be shown or not.
	 * @param shouldContain - true if the notification should be shown, false if it should not be shown
	 * @param message - the message of the notification
	 * @param errorMessage - the error message to be shown if the notification is not shown
	 * @param timeout - the timeout to wait for the notification
	 * @param interval - the interval to wait for the notification
	 */
	async function waitForNotification(
		shouldContain: boolean,
		message: string,
		errorMessage: string = 'Timeout waiting for the notification of the Maven dependency update',
		timeout: number = 5_000,
		interval: number = 500,
		notificationType: NotificationType = NotificationType.Info,
	) {
		await driver.wait(
			async () => {
				try {
					const notificationsCenter = await new Workbench().openNotificationsCenter();
					const notifications = await notificationsCenter.getNotifications(notificationType);
					const messages = await Promise.all(notifications.map(async (notification) => await notification.getMessage()));
					return shouldContain ? messages.some((msg) => msg === message) : !messages.some((msg) => msg === message); // if shouldContain is true, we wait for the message to be present, otherwise we wait for the message to be absent
				} catch {
					return false;
				}
			},
			timeout,
			errorMessage,
			interval,
		);
	}

	/**
	 * Add the SQL component step to the topology.
	 */
	async function addSqlComponentStep() {
		// hover over edge to show add step button
		const setBodyToLogEdge = await driver.findElement(By.css('g[data-id^="my-camel-quarkus-route|route.from.steps.0.setBody >>> route.from.steps.1.log"]'));
		await driver.actions().move({ origin: setBodyToLogEdge, duration: 2_000 }).perform();

		// click Add Step button
		const addStepButton = await setBodyToLogEdge.findElement(By.className('custom-edge__add-step add-step-icon'));
		await addStepButton.click();

		// add text into catalog filter
		await driver.wait(until.elementLocated(By.className('pf-v6-c-text-input-group__text-input')), 5_000);
		const textInput = await driver.findElement(By.className('pf-v6-c-text-input-group__text-input'));
		await textInput.click();
		await textInput.clear();
		await textInput.sendKeys('sql');

		await driver.wait(until.elementLocated(By.css('div[data-testid="tile-sql"]')), 5_000);

		// select SQL component from catalog
		const sqlComponent = await driver.findElement(By.css('div[data-testid="tile-sql"]'));
		await sqlComponent.click();
	}

	/**
	 * Delete the SQL component step from the topology.
	 */
	async function deleteSqlComponentStep() {
		// activate and switch to Kaoto editor
		kaotoWebview = (
			await openAndSwitchToKaotoFrame(path.join(workspaceFolder, 'src/main/resources/camel'), 'my-camel-quarkus-route.camel.yaml', driver, true)
		).kaotoWebview;

		// right click on SQL component node
		const sqlComponent = await driver.findElement(By.css('g[data-nodelabel="sql"]'));
		await driver.actions().contextClick(sqlComponent).perform();

		await workaroundToRedrawContextualMenu(kaotoWebview);

		// click Delete button
		const deleteButton = await driver.findElement(By.css('li[data-testid="context-menu-item-delete"]'));
		await deleteButton.click();

		// save editor
		await kaotoWebview.switchBack();
		try {
			await new Workbench().executeCommand('File: Save');
		} catch {
			// Sometimes there is an ElementNotInteractableError: element not interactable
			await new Workbench().executeCommand('File: Save');
		}
	}
});
