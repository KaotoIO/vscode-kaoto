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
import { ProgressLocation, window } from 'vscode';
import { execSync } from 'child_process';
import { basename, isAbsolute } from 'path';

export const KAOTO_FILE_PATH_GLOB: string = '**/*.{yml,yaml}';

export async function isCamelPluginInstalled(plugin: string): Promise<boolean> {
	let output = '';
	// it takes always few seconds to compute after click on deploy button
	//  - can be confusing for user without any UI feedback, it looks like nothing is happening after click on a button..
	await window.withProgress({
		location: ProgressLocation.Window,
		cancellable: false,
		title: 'Checking Camel JBang Kubernetes plugin...'
	}, async (progress) => {
		progress.report({ increment: 0 });
		output = execSync('jbang camel@apache/camel plugin get', { stdio: 'pipe' }).toString();
		progress.report({ increment: 100 });
	});
	return output.includes(plugin);
}

// Check if the input is an absolute path
export function getBasenameIfAbsolute(input: string): string {
	if (isAbsolute(input)) {
		return basename(input); // If it's absolute, return only the basename
	}
	return input;
}
