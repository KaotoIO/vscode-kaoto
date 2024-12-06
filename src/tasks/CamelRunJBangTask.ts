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
'use strict';

import { TaskScope } from "vscode";
import { CamelJBangTask } from "./CamelJBangTask";
import { CamelJBang } from "../helpers/CamelJBang";

export class CamelRunJBangTask extends CamelJBangTask {

	constructor(patternForCamelFiles: string, cwd?: string, port?: number) {
		super(TaskScope.Workspace,
			'Run Camel Application with JBang',
			new CamelJBang().run(patternForCamelFiles, cwd, port));
        this.isBackground = true;

		// TODO generate port number in giver range :8080 - :XXXX ??

		// TODO spawn http agent for giver port
	}
}
