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
import { TaskRevealKind, TaskScope, WorkspaceFolder } from 'vscode';
import { CamelJBangTask } from './CamelJBangTask';
import { CamelJBang } from '../helpers/CamelJBang';

export class CamelExportJBangTask extends CamelJBangTask {
	constructor(scope: WorkspaceFolder | TaskScope.Workspace, filePath: string, gav: string, runtime: string, outputPath: string) {
		super(scope, 'Create a Camel project', new CamelJBang().export(filePath, gav, runtime, outputPath), true, TaskRevealKind.Silent);
	}
}
