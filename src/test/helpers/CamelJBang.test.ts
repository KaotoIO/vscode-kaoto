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

suite('CamelJbang tests', function () {
	test('Can retrieve version from Maven context', async () => {
		const files = await vscode.workspace.findFiles('camel-maven-quarkus-project/src/main/resources/camel/my-camel-quarkus-route.yaml');
		assert(files.length === 1, 'For the test, we expect to have a single file in the camel quarkus project');
		const runtimeInfo = await new CamelJBang().getRuntimeInfoFromMavenContext(files[0].fsPath);
		const expected = '{"runtime":"camel-quarkus","camelVersion":"4.11.0","camelQuarkusVersion":"3.22.0","quarkusVersion":"3.22.2"}';
		assert(
			runtimeInfo?.replace(/(?:\r\n|\r|\n)/g, '') === expected,
			`expected: ${expected}\n
               actual: ${runtimeInfo}`,
		);
	});

	test('Return undefined when calling getRuntimeInfoFromMavenContext on a file not in a Maven project', async () => {
		const files = await vscode.workspace.findFiles('my.yaml');
		assert(files.length === 1, 'For the test, we expect to have a single file named my.yaml in the workspace');
		const runtimeInfo = await new CamelJBang().getRuntimeInfoFromMavenContext(files[0].fsPath);
		assert(runtimeInfo === undefined, 'on a non-Maven Project, we should have undefined returned');
	});
});
