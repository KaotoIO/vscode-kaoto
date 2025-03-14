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

import { ProgressLocation, window } from 'vscode';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { normalize } from 'path';

/**
 * Utilizes constants, methods, ... used in both, desktop or web extension context
 */

export const KAOTO_FILE_PATH_GLOB: string = '**/*.{yml,yaml}';

export async function verifyJBangExists(): Promise<boolean> {
	const execPromise = promisify(exec);
	return await window.withProgress<boolean>(
		{
			location: ProgressLocation.Window,
			cancellable: false,
			title: 'Checking JBang executable on PATH...',
		},
		async (progress) => {
			progress.report({ increment: 0 });
			try {
				const { stdout } = await execPromise('jbang --version');
				progress.report({ increment: 100 });
				return !stdout.includes('not found'); // JBang exists
			} catch (error) {
				progress.report({ increment: 100 });
				return false; // JBang not found
			}
		},
	);
}

export async function verifyCamelJBangTrustedSource(): Promise<boolean> {
	const output = await runJBangCommandWithStatusBar('trust list', 'Checking Apache Camel Trusted Source is a part of JBang configuration...');
	return output.includes('https://github.com/apache/camel/');
}

export async function verifyCamelKubernetesPluginIsInstalled(): Promise<boolean> {
	const output = await runJBangCommandWithStatusBar('camel@apache/camel plugin get', 'Checking Camel JBang Kubernetes plugin...');
	return output.includes('kubernetes');
}

async function runJBangCommandWithStatusBar(args: string, msg: string): Promise<string> {
	let output = '';
	await window.withProgress(
		{
			location: ProgressLocation.Window,
			cancellable: false,
			title: msg,
		},
		async (progress) => {
			progress.report({ increment: 0 });
			output = execSync(`jbang ${args}`, { stdio: 'pipe' }).toString();
			progress.report({ increment: 100 });
		},
	);
	return output;
}

/**
 * Compare two given paths to see if they are the same. Normalizes the string and takes case-sensitive OSes into account.
 *
 * @param path1 string representing the first path to be compared
 * @param path2 string representing t,he second path to be compared
 * @returns `true` if paths are equal `false` otherwise.
 */
export function arePathsEqual(path1: string, path2: string): boolean {
	const normalizedPath1 = normalize(path1);
	const normalizedPath2 = normalize(path2);

	// on Windows and macOS, perform case-insensitive comparison
	if (process.platform === 'win32' || process.platform === 'darwin') {
		return normalizedPath1.toLowerCase() === normalizedPath2.toLowerCase();
	}

	// on Linux (and other case-sensitive systems), compare as-is
	return normalizedPath1 === normalizedPath2;
}
