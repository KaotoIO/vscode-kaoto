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
import * as vscode from 'vscode';
import { KaotoOutputChannel } from './KaotoOutputChannel';

export class WhatsNewPanel {
	private static currentPanel: vscode.WebviewPanel | undefined;

	public static async show(context: vscode.ExtensionContext, version: string): Promise<void> {
		const folderVersion = this.extractMajorMinor(version);
		const whatsNewFolder = vscode.Uri.joinPath(context.extensionUri, 'resources', 'whats-new', folderVersion);
		const indexMdUri = vscode.Uri.joinPath(whatsNewFolder, 'index.md');

		try {
			const bytes = await vscode.workspace.fs.readFile(indexMdUri);
			const markdown = new TextDecoder('utf-8').decode(bytes);

			const htmlContent: string = (await vscode.commands.executeCommand('markdown.api.render', markdown)) as string;

			const panel = vscode.window.createWebviewPanel('kaoto.whatsNew', `What's New in Kaoto ${folderVersion}`, {
				viewColumn: vscode.ViewColumn.Active,
				preserveFocus: false,
			});

			panel.webview.html = this.getHtmlForWebview(htmlContent, folderVersion);

			panel.onDidDispose(() => {
				if (WhatsNewPanel.currentPanel === panel) {
					WhatsNewPanel.currentPanel = undefined;
				}
			});

			WhatsNewPanel.currentPanel = panel;
		} catch (err) {
			KaotoOutputChannel.logWarning(`What's New content is not available for this version. ${String(err)}`);
		}
	}

	private static extractMajorMinor(version: string): string {
		const regExp = new RegExp(/(\d+)\.(\d+)/);
		const match = regExp.exec(version);
		if (match) {
			return `${match[1]}.${match[2]}`;
		}
		return version;
	}

	private static getHtmlForWebview(htmlBody: string, folderVersion: string): string {
		const blogUrl = `https://kaoto.io/blog/kaoto-${folderVersion}-release/`;

		return [
			'<!DOCTYPE html>',
			'<html lang="en">',
			'<head>',
			'<meta charset="UTF-8">',
			`<meta name="viewport" content="width=device-width, initial-scale=1.0">`,
			'<style>', // Minimal readable styling
			'body { font-family: var(--vscode-font-family); padding: 0 1.2rem 2rem; color: var(--vscode-foreground); }',
			'h1, h2, h3 { color: var(--vscode-foreground); }',
			'.logo { max-width: 50%; height: auto; margin-top: 1rem; margin-bottom: 1rem; }', // Kaoto logo
			'a { color: var(--vscode-textLink-foreground); }',
			'ul { padding-left: 1.2rem; }',
			'.blog-note { margin: 1rem 0 1.2rem; padding: 0.8rem 1rem; border-left: 3px solid var(--vscode-textLink-foreground); }',
			'</style>',
			'</head>',
			'<body>',
			`<img class="logo" src="https://raw.githubusercontent.com/KaotoIO/vscode-kaoto/57103641d7c3f2d7ac6be9433d1d360d9732a926/images/logo-kaoto.png" alt="Kaoto">`,
			htmlBody,
			`<div class="blog-note">Read the full blog post on our official site - <a href="${blogUrl}" target="_blank" rel="noreferrer noopener">${blogUrl}</a></div>`,
			'</body>',
			'</html>',
		].join('\n');
	}
}
