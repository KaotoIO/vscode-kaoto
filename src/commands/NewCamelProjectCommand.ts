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
import { QuickPickItem, window } from "vscode";
import { NewCamelQuarkusProjectCommand } from "./NewCamelQuarkusProjectCommand";
import { NewCamelSpringBootProjectCommand } from "./NewCamelSpringBootProjectCommand";
import { AbstractNewCamelProjectCommand } from "./AbstractNewCamelProjectCommand";

export class NewCamelProjectCommand extends AbstractNewCamelProjectCommand {

	public static readonly ID_COMMAND_CAMEL_NEW_PROJECT = 'kaoto.new.project';

	async getRuntime(): Promise<string | undefined> {
		const selection = await this.showQuickPickForCamelRuntime();
		return selection.label ?? undefined;
	}

	protected async showQuickPickForCamelRuntime(): Promise<QuickPickItem> {
        const items: QuickPickItem[] = [
            { label: 'quarkus', description: 'Camel Quarkus' },
            { label: 'spring-boot', description: 'Camel on Spring Boot' }
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