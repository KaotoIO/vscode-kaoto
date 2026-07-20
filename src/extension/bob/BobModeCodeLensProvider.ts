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
import { parse } from 'yaml';
import * as vscode from 'vscode';
import { COMMAND_BOB_MODES_TRY } from '../../constants';

/** Regex to match `- slug: <value>` lines in the YAML source text. */
const SLUG_LINE_RE = /^\s*-\s*slug:\s*(.+)$/;

export class BobModeCodeLensProvider implements vscode.CodeLensProvider {
	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		const text = document.getText();
		const lines = text.split('\n');

		// Build slug → name map from parsed YAML
		const nameMap = new Map<string, string>();
		try {
			const parsed = parse(text) as { customModes?: unknown[] } | null;
			const modes = parsed?.customModes;
			if (Array.isArray(modes)) {
				for (const entry of modes) {
					if (!entry || typeof entry !== 'object') {
						continue;
					}
					const e = entry as Record<string, unknown>;
					const slug = typeof e['slug'] === 'string' ? e['slug'].trim() : undefined;
					const name = typeof e['name'] === 'string' ? e['name'].trim() : undefined;
					if (slug) {
						nameMap.set(slug, name ?? slug);
					}
				}
			}
		} catch {
			// File may be mid-edit — proceed without name resolution
		}

		const lenses: vscode.CodeLens[] = [];

		for (let i = 0; i < lines.length; i++) {
			const match = SLUG_LINE_RE.exec(lines[i]);
			if (!match) {
				continue;
			}

			const slug = match[1].trim();
			const label = nameMap.get(slug) ?? slug;
			const range = new vscode.Range(i, 0, i, 0);

			lenses.push(
				// Lens 1: Open in Kaoto
				new vscode.CodeLens(range, {
					title: '$(file-symlink-file) Open in Kaoto',
					command: 'vscode.openWith',
					arguments: [document.uri, 'webviewEditorsKaoto'],
				}),
				// Lens 2: Try with Kaoto
				new vscode.CodeLens(range, {
					title: '$(play) Try with Kaoto',
					command: COMMAND_BOB_MODES_TRY,
					arguments: [{ slug, label }],
				}),
			);
		}

		return lenses;
	}
}
