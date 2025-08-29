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

import { ProgressLocation, window, workspace, WorkspaceFolder } from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import fs from 'fs';

/**
 * Utilizes constants, methods, ... used in both, desktop or web extension context
 */

export const KAOTO_FILE_PATH_GLOB: string = '**/*.{yml,yaml,xml}';

export const KAOTO_CAMEL_JBANG_VERSION_SETTING_ID: string = 'kaoto.camelJbang.version';

export const KAOTO_CAMEL_JBANG_RUN_ARGUMENTS_SETTING_ID: string = 'kaoto.camelJbang.runArguments';

export const KAOTO_CAMEL_JBANG_RUN_SOURCE_DIR_ARGUMENTS_SETTING_ID: string = 'kaoto.camelJbang.runFolderOrWorkspaceArguments';

export const KAOTO_CAMEL_JBANG_RED_HAT_MAVEN_REPOSITORY_SETTING_ID: string = 'kaoto.camelJbang.redHatMavenRepository';

export const KAOTO_CAMEL_JBANG_RED_HAT_MAVEN_REPOSITORY_GLOBAL_SETTING_ID: string = 'kaoto.camelJbang.redHatMavenRepository.global';

export const KAOTO_CAMEL_JBANG_KUBERNETES_RUN_ARGUMENTS_SETTING_ID: string = 'kaoto.camelJbang.kubernetesRunArguments';

export const KAOTO_MAVEN_CAMEL_JBANG_EXPORT_FOLDER_ARGUMENTS_SETTING_ID: string = 'kaoto.maven.camelJbang.exportProjectArguments';

export const KAOTO_LOCAL_KAMELET_DIRECTORIES_SETTING_ID: string = 'kaoto.localKameletDirectories';

export const KAOTO_INTEGRATIONS_FILES_REGEXP_SETTING_ID: string = 'kaoto.integrations.files.regexp';

export const CAMEL_TRUSTED_SOURCE_URL: string = 'https://github.com/apache/camel/';

export const CITRUS_TRUSTED_SOURCE_URL: string = 'https://github.com/citrusframework/citrus/';

export async function verifyJBangExists(): Promise<boolean> {
	return await runJBangCommandWithStatusBar(`version`, `Checking JBang executable on PATH...`).then((output) => !output.stderr.includes('command not found')); // JBang exists
}

export async function verifyCamelPluginsAreInstalled(plugins: string[]): Promise<{ plugin: string; installed: boolean }[]> {
	return await runJBangCommandWithStatusBar(`camel@apache/camel plugin get`, `Checking Camel JBang plugins...`).then((output) => {
		return plugins.map((plugin) => ({ plugin, installed: output.stdout.includes(plugin) }));
	});
}

export async function verifyJBangTrustedSources(urls: string[]): Promise<{ url: string; exists: boolean }[]> {
	return await runJBangCommandWithStatusBar(`trust list`, `Checking JBang Trusted Sources...`).then((output) => {
		return urls.map((url) => ({ url, exists: output.stdout.includes(url) }));
	});
}

export async function runJBangCommandWithStatusBar(args: string, msg: string): Promise<{ stdout: string; stderr: string }> {
	const execPromise = promisify(exec);
	return await window.withProgress(
		{
			location: ProgressLocation.Window,
			cancellable: false,
			title: `Kaoto: ${msg}`,
		},
		async (progress) => {
			progress.report({ increment: 0 });
			try {
				const { stdout, stderr } = await execPromise(`jbang ${args}`);
				progress.report({ increment: 100 });
				return { stdout, stderr };
			} catch (error) {
				return { stdout: '', stderr: error instanceof Error ? error.message : String(error) };
			}
		},
	);
}

/**
 * Compare two given paths to see if they are the same. Normalizes the string and takes case-sensitive OSes into account.
 *
 * @param path1 string representing the first path to be compared
 * @param path2 string representing t,he second path to be compared
 * @returns `true` if paths are equal `false` otherwise.
 */
export function arePathsEqual(path1: string, path2: string): boolean {
	const normalizedPath1 = path.normalize(path1);
	const normalizedPath2 = path.normalize(path2);

	// on Windows and macOS, perform case-insensitive comparison
	if (process.platform === 'win32' || process.platform === 'darwin') {
		return normalizedPath1.toLowerCase() === normalizedPath2.toLowerCase();
	}

	// on Linux (and other case-sensitive systems), compare as-is
	return normalizedPath1 === normalizedPath2;
}

/**
 * Find the folder containing the pom.xml file for a given file.
 *
 * @param currentFile string representing the file to find the pom.xml folder for
 * @returns the folder containing the pom.xml file or undefined if not found
 */
export function findFolderOfPomXml(currentFile: string): string | undefined {
	const parentFolder = path.dirname(currentFile);
	if (parentFolder !== undefined && parentFolder !== currentFile) {
		if (fs.existsSync(path.join(parentFolder, 'pom.xml'))) {
			return parentFolder;
		} else {
			return findFolderOfPomXml(parentFolder);
		}
	}
	return undefined;
}

/**
 * Resolve a list of paths against the current working directory.
 *
 * @param paths The list of paths to resolve
 * @param cwd The current working directory
 * @returns The resolved paths
 */
export function resolvePaths(paths: string[], cwd: string): Set<string> {
	const allResolvedPaths = paths.map((p) => resolvePathAgainstCwd(p, cwd));
	return new Set(allResolvedPaths);
}

/**
 * Helper to properly resolve path to be relative to cwd unless already absolute.
 *
 * @param pathString The path string to resolve
 * @param cwd The current working directory
 * @returns The resolved path
 */
// The cwd parameter changes based on which file/folder is clicked in the integrations view.
function resolvePathAgainstCwd(pathString: string, cwd: string): string {
	// Expand VS Code variables first
	const expandedPath = expandVSCodeVariables(pathString, cwd);

	// resolve absolute paths first
	if (path.isAbsolute(expandedPath)) {
		return path.normalize(expandedPath);
	}

	// then resolve relative paths against cwd
	return path.normalize(path.resolve(cwd, expandedPath));
}

/**
 * Expands VS Code variables in a path string.
 * Supports common variables - ${workspaceFolder}, ${workspaceFolderBasename}, ${cwd} - in the path string.
 *
 * @param pathString The path string that may contain VS Code variables
 * @param cwd The current working directory (used for ${cwd} variable)
 * @returns The path string with variables expanded
 */
function expandVSCodeVariables(pathString: string, cwd: string): string {
	if (!pathString.includes('${')) {
		return pathString;
	}

	// Find workspace folder that contains cwd, or use first workspace folder
	const workspaceFolders = workspace.workspaceFolders;
	let workspaceFolder: WorkspaceFolder | undefined;

	if (workspaceFolders && workspaceFolders.length > 0) {
		// Try to find workspace folder that contains cwd
		workspaceFolder = workspaceFolders.find((wf) => cwd.startsWith(wf.uri.fsPath)) || workspaceFolders[0];
	}

	let expanded = pathString;

	// Handle ${workspaceFolder}
	if (workspaceFolder) {
		expanded = expanded.replaceAll('${workspaceFolder}', workspaceFolder.uri.fsPath);
		expanded = expanded.replaceAll('${workspaceFolderBasename}', workspaceFolder.name);
	}

	// Handle ${cwd}
	expanded = expanded.replaceAll('${cwd}', cwd);

	return expanded;
}
