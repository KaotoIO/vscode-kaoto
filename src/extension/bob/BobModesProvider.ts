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
import { existsSync, readFileSync } from 'fs';
import { parse } from 'yaml';
import * as vscode from 'vscode';
import { tryBobMode } from './BobChatUtils';
import { KaotoOutputChannel } from '../KaotoOutputChannel';
import { BobModeItem } from './BobModeItem';

/** Regex to match `- slug: <value>` lines in the YAML source text. */
const SLUG_LINE_RE = /^\s*-\s*slug:\s*(.+)$/;

export class BobModesProvider implements vscode.TreeDataProvider<BobModeItem> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<BobModeItem | undefined | null | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private readonly fileWatcher: vscode.FileSystemWatcher;

	constructor() {
		this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/.bob/custom_modes.{yaml,yml}');
		this.fileWatcher.onDidChange(this.refresh.bind(this));
		this.fileWatcher.onDidCreate(this.refresh.bind(this));
		this.fileWatcher.onDidDelete(this.refresh.bind(this));
	}

	getTreeItem(item: BobModeItem): BobModeItem {
		return item;
	}

	getChildren(item?: BobModeItem): Thenable<BobModeItem[]> {
		if (item) {
			return Promise.resolve([]);
		}
		return Promise.resolve(this.loadModes());
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	dispose(): void {
		this.fileWatcher?.dispose();
	}

	// ─── Private ────────────────────────────────────────────────────────────────

	private loadModes(): BobModeItem[] {
		const wsFolders = vscode.workspace.workspaceFolders;
		if (!wsFolders?.length) {
			return [];
		}

		const bobDir = vscode.Uri.joinPath(wsFolders[0].uri, '.bob');
		const yamlPath = vscode.Uri.joinPath(bobDir, 'custom_modes.yaml').fsPath;
		const ymlPath = vscode.Uri.joinPath(bobDir, 'custom_modes.yml').fsPath;

		let filePath: string | undefined;
		if (existsSync(yamlPath)) {
			filePath = yamlPath;
		} else if (existsSync(ymlPath)) {
			filePath = ymlPath;
		}

		if (!filePath) {
			return [];
		}

		const fileUri = vscode.Uri.file(filePath);

		try {
			const content = readFileSync(filePath, 'utf8');

			// Build slug → line-number map from raw source (zero-based)
			const slugLineMap = new Map<string, number>();
			const lines = content.split('\n');
			for (let i = 0; i < lines.length; i++) {
				const match = SLUG_LINE_RE.exec(lines[i]);
				if (match) {
					slugLineMap.set(match[1].trim(), i);
				}
			}

			const parsed = parse(content) as { customModes?: unknown[] } | null;
			const modes = parsed?.customModes;
			if (!Array.isArray(modes)) {
				return [];
			}

			const items: BobModeItem[] = [];
			for (const entry of modes) {
				if (!entry || typeof entry !== 'object') {
					continue;
				}
				const e = entry as Record<string, unknown>;
				const slug = typeof e['slug'] === 'string' ? e['slug'].trim() : undefined;
				if (!slug) {
					KaotoOutputChannel.logWarning('[BobModesProvider] Skipping mode entry with missing slug');
					continue;
				}
				const name = typeof e['name'] === 'string' ? e['name'].trim() : undefined;
				const modeDescription = typeof e['description'] === 'string' ? e['description'].trim() : undefined;
				const line = slugLineMap.get(slug) ?? 0;
				items.push(new BobModeItem(slug, name, fileUri, line, modeDescription));
			}
			return items;
		} catch (err) {
			KaotoOutputChannel.logError(`[BobModesProvider] Failed to parse ${filePath}`, err);
			return [];
		}
	}
}

export { tryBobMode };
