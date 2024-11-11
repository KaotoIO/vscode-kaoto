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

import { QuickPickItem, Uri, commands, window } from "vscode";
import { NewCamelQuarkusProjectCommand } from "./NewCamelQuarkusProjectCommand";
import { NewCamelSpringBootProjectCommand } from "./NewCamelSpringBootProjectCommand";

export class NewCamelProjectCommand {

	public static readonly ID_COMMAND_CAMEL_NEW_PROJECT = 'camel.new.project';

	public async create(): Promise<void> {
		const selection = await this.showQuickPickForCamelRuntime();
		if (selection) {
			const cmd = this.getCamelProjectCommandFromSelection(selection.label);
			if(cmd){
				await commands.executeCommand(cmd);
			}
		}
	}

	protected async showQuickPickForCamelRuntime(): Promise<QuickPickItem> {
        const items: QuickPickItem[] = [
            { label: 'Quarkus', description: 'Camel Quarkus' },
            { label: 'Spring Boot', description: 'Camel Spring Boot' }
        ];
        return await window.showQuickPick(items, {
            placeHolder: 'Please select a Camel Runtime.',
            title: 'Runtime selection...'
        }) || { label: 'Internal error: Try again.' };
    }

	protected getCamelProjectCommandFromSelection(selection: string): string | undefined {
		switch (selection) {
			case 'Quarkus':
				return NewCamelQuarkusProjectCommand.ID_COMMAND_CAMEL_QUARKUS_PROJECT;
			case 'Spring Boot':
				return NewCamelSpringBootProjectCommand.ID_COMMAND_CAMEL_SPRINGBOOT_PROJECT;
			default:
				break;
		}
		return undefined;
	}
}