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
import { ShellExecution, ShellExecutionOptions } from 'vscode';
import { CamelJBang } from './CamelJBang';
import path from 'path';
import { readdir } from 'fs/promises';
import { Dirent } from 'fs';

export class CamelTestJBang extends CamelJBang {
	constructor(jbang: string = 'jbang') {
		super(jbang);
	}

	public init(file: string, cwd?: string): ShellExecution {
		const shellExecOptions: ShellExecutionOptions = {
			cwd: cwd ?? undefined,
		};
		return new ShellExecution(this.jbang, [...this.defaultJbangArgs, 'test', 'init', `'${file}'`], shellExecOptions);
	}

	public async run(filePath: string, cwd: string, _port?: number): Promise<{ execution: ShellExecution; resolvedPort: number }> {
		const fileName = path.basename(filePath);

		const shellExecOptions: ShellExecutionOptions = {
			cwd: cwd,
		};

		const execution = new ShellExecution(
			this.jbang,
			[...this.defaultJbangArgs, 'test', 'run', fileName].filter(function (arg) {
				return arg !== undefined && arg !== null && arg !== ''; // remove empty string, null and undefined values
			}),
			shellExecOptions,
		);

		// Test runs don't use ports for monitoring
		return { execution, resolvedPort: CamelJBang.NO_PORT };
	}

	public async runFolder(cwd: string): Promise<ShellExecution> {
		const testFolder = await this.resolveTestFolder(cwd);

		const shellExecOptions: ShellExecutionOptions = {
			cwd: testFolder,
		};

		return new ShellExecution(
			this.jbang,
			[...this.defaultJbangArgs, 'test', 'run', '*'].filter(function (arg) {
				return arg !== undefined && arg !== null && arg !== ''; // remove empty string, null and undefined values
			}),
			shellExecOptions,
		);
	}

	/**
	 * BFS through the directory hierarchy under baseDir to find the first
	 * subdirectory whose name contains 'test'. Returns baseDir itself if it
	 * already contains 'test' in its name, or falls back to baseDir when no
	 * test directory is found.
	 */
	private async resolveTestFolder(baseDir: string): Promise<string> {
		if (this.isTestFolder(path.basename(baseDir))) {
			return baseDir;
		}

		const EXCLUDED = new Set(['node_modules', '.git', 'dist', 'lib', 'target', '.citrus-jbang', '.vscode', '.mvn', 'out']);
		const queue: string[] = [baseDir];

		while (queue.length > 0) {
			const current = queue.shift()!;
			let entries: Dirent[] = [];
			try {
				entries = await readdir(current, { withFileTypes: true });
			} catch {
				continue;
			}

			for (const entry of entries) {
				if (!entry.isDirectory() || EXCLUDED.has(entry.name)) {
					continue;
				}
				const fullPath = path.join(current, entry.name);
				if (this.isTestFolder(entry.name)) {
					return fullPath;
				}
				queue.push(fullPath);
			}
		}

		return baseDir;
	}

	private isTestFolder(name: string): boolean {
		const n = name.toLowerCase();
		return n === 'test' || n === 'tests' || n.endsWith('-test') || n.endsWith('-tests');
	}
}
