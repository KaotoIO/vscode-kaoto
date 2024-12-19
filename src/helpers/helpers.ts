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
import { ProgressLocation, window, workspace } from 'vscode';
import { execSync } from 'child_process';
import { basename, isAbsolute, normalize } from 'path';

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

/**
 * If there are any folder in the current workspace gets the path to the first one.
 *
 * @returns string represent the fsPath of the first folder in the current opened workspace, undefined otherwise.
 */
export function getCurrentWorkingDirectory(): string | undefined {
	const workspaceFolders = workspace.workspaceFolders;
	if (workspaceFolders && workspaceFolders.length > 0) {
		// Return the first workspace folder
		return workspaceFolders[0].uri.fsPath;
	}
	return undefined;
}

/**
 * Compare two given paths to see if they are equal. Normalizes the string and takes into acount case sentive OSes.
 *
 * @param path1 string representing the first path to be compared
 * @param path2 string representing t,he second path to be compared
 * @returns `true` if paths are equal `false` otherwise.
 */
export function arePathsEqual(path1: string, path2: string): boolean {
	// Normalize both paths
	const normalizedPath1 = normalize(path1);
	const normalizedPath2 = normalize(path2);

	// On Windows and macOS, perform case-insensitive comparison
	if (process.platform === 'win32' || process.platform === 'darwin') {
		return normalizedPath1.toLowerCase() === normalizedPath2.toLowerCase();
	}

	// On Linux (and other case-sensitive systems), compare as-is
	return normalizedPath1 === normalizedPath2;
}
