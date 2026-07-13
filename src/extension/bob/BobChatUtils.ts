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
import { KaotoOutputChannel } from '../KaotoOutputChannel';

/**
 * Shows an input box for the actual user prompt, prepends the mode-switch
 * instruction, then sends the generated Bob prompt to Bob IDE chat.
 *
 * Tries bob-code.newTask (Bob v1), then bob-code.sendMessageWithHiddenPrompt
 * (Bob v2, two-argument signature), then falls back to clipboard.
 */
export async function tryBobMode(slug: string, modeName: string): Promise<void> {
	const userPrompt = await vscode.window.showInputBox({
		title: `Try mode: ${modeName}`,
		prompt: 'Enter the prompt to send to Bob in this mode. Press Escape to cancel.',
		ignoreFocusOut: true,
	});
	if (!userPrompt) {
		return;
	}

	const bobPrompt = `Switch to ${modeName} mode.\n\n${userPrompt}`;

	await sendToBobChat(bobPrompt);
}

export async function sendToBobChat(prompt: string): Promise<void> {
	// Ensure IBM.bob-code extension is active
	const bobExt = vscode.extensions.getExtension('IBM.bob-code');
	if (bobExt && !bobExt.isActive) {
		await bobExt.activate();
	}

	// Try Bob v1 API
	try {
		await vscode.commands.executeCommand('bob-code.newTask', { prompt });
		return;
	} catch {
		// v1 not available, fall through to v2
	}

	// Try Bob v2 API (two-argument signature reverse-engineered from Propel extension)
	try {
		await vscode.commands.executeCommand('bob-code.sendMessageWithHiddenPrompt', undefined, prompt);
		return;
	} catch {
		// v2 not available, fall through to clipboard fallback
	}

	// Clipboard fallback
	KaotoOutputChannel.logWarning('[BobChatUtils] bob-code commands not available, copying prompt to clipboard');
	await vscode.env.clipboard.writeText(prompt);
	void vscode.window.showInformationMessage('Bob IDE not available. Prompt copied to clipboard.');
}
