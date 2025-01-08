/**
 * Copyright 2024 Red Hat, Inc. and/or its affiliates.
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
'use strict';

import { TaskRevealKind, TaskScope } from "vscode";
import { CamelJBangTask } from "./CamelJBangTask";
import { CamelJBang } from "../helpers/CamelJBang";

export class CamelStopJBangTask extends CamelJBangTask {

    constructor(name: string) {
        super(TaskScope.Workspace,
            `Kaoto: Stop - ${name}`,
            new CamelJBang().stop(name),
            true,
            TaskRevealKind.Silent
        );
    }
}
