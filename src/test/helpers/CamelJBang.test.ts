/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License", destination); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { assert } from 'chai';
import { CamelJBang } from '../../helpers/CamelJBang';
import * as vscode from 'vscode';
import * as os from 'os';
import { RuntimeMavenInformation } from '../../tasks/RuntimeMavenInformation';

suite('CamelJbang tests', function () {
	this.beforeAll(function () {
		if (os.platform() === 'win32') {
			// Skipped on Windows due to https://github.com/microsoft/vscode-test/issues/298
			this.skip();
		}
	});

	test('Can retrieve runtime information from Maven context for Quarkus project', async () => {
		const files = await vscode.workspace.findFiles('camel-maven-quarkus-project/src/main/resources/camel/my-camel-quarkus-route.camel.yaml');
		assert(files.length === 1, 'For the test, we expect to have a single file in the camel quarkus project');
		const runtimeInfo = await new CamelJBang().getRuntimeInfoFromMavenContext(files[0].fsPath);
		const expected: RuntimeMavenInformation = {
			runtime: 'quarkus',
			camelVersion: '4.11.0',
			camelQuarkusVersion: '3.22.0',
			quarkusVersion: '3.22.2',
			quarkusBomGroupId: 'io.quarkus.platform',
			quarkusBomArtifactId: 'quarkus-bom',
			camelQuarkusBomGroupId: 'io.quarkus.platform',
			camelQuarkusBomArtifactId: 'quarkus-camel-bom',
		};
		assert.deepEqual(runtimeInfo, expected);
	});

	test('Can retrieve runtime information from Maven context for Spring Boot project', async () => {
		const files = await vscode.workspace.findFiles('camel-maven-springboot-project/src/main/resources/camel/my-camel-spring-boot-route.camel.yaml');
		assert(files.length === 1, 'For the test, we expect to have a single file in the camel spring boot project');
		const runtimeInfo = await new CamelJBang().getRuntimeInfoFromMavenContext(files[0].fsPath);
		const expected: RuntimeMavenInformation = {
			runtime: 'spring-boot',
			camelVersion: '4.13.0',
			camelSpringBootBomArtifactId: 'camel-spring-boot-bom',
			camelSpringBootBomGroupId: 'org.apache.camel.springboot',
			camelSpringBootVersion: '4.13.0',
			springBootVersion: '3.5.3',
		};
		assert.deepEqual(runtimeInfo, expected);
	});

	test('Can retrieve runtime information from Maven context for Main project', async () => {
		const files = await vscode.workspace.findFiles('camel-maven-main-project/src/main/resources/camel/my-camel-main-route.camel.yaml');
		assert(files.length === 1, 'For the test, we expect to have a single file in the camel main project');
		const runtimeInfo = await new CamelJBang().getRuntimeInfoFromMavenContext(files[0].fsPath);
		const expected: RuntimeMavenInformation = {
			runtime: 'main',
			camelVersion: '4.13.0',
		};
		assert.deepEqual(runtimeInfo, expected);
	});

	test('Return undefined when calling getRuntimeInfoFromMavenContext on a file not in a Maven project', async () => {
		const files = await vscode.workspace.findFiles('my.yaml');
		assert(files.length === 1, 'For the test, we expect to have a single file named my.yaml in the workspace');
		const runtimeInfo = await new CamelJBang().getRuntimeInfoFromMavenContext(files[0].fsPath);
		assert(runtimeInfo === undefined, 'on a non-Maven Project, we should have undefined returned');
	});
});
