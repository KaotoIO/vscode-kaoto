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
import * as vscode from 'vscode';
import { waitUntil } from 'async-wait-until';

suite('Extension is activated', () => {
    test('Kaoto Extension is activated when the workspace used for tests contains yaml files', async() => {
        const extension = await vscode.extensions.getExtension('redhat.vscode-kaoto');
        assert.isNotNull(extension, 'VS Code Kaoto not found');
        await waitUntil(() => {
            return extension?.isActive;
        }, 10000, 1000);
    });
})
