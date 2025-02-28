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

export class KaotoOutputChannel {
	private static instance: vscode.OutputChannel;

	// Get or create the Kaoto Output Channel instance
	public static getInstance(): vscode.OutputChannel {
		if (!KaotoOutputChannel.instance) {
			KaotoOutputChannel.instance = vscode.window.createOutputChannel('Kaoto');
		}
		return KaotoOutputChannel.instance;
	}

	public static logInfo(message: string): void {
		this.logMessage('INFO', message);
	}

	public static logWarning(message: string): void {
		this.logMessage('WARNING', message);
	}

	public static logError(message: string, error?: any): void {
		const errorMsg = error instanceof Error ? error.message : String(error);
		this.logMessage('ERROR', `${message}\n${errorMsg}`);
	}

	// Log a formatted message with a timestamp
	private static logMessage(level: string, message: string): void {
		const timestamp = new Date().toUTCString();
		this.getInstance().appendLine(`[${timestamp}] [${level}] ${message}`);
	}

	// Dispose the Output Channel (mainly when the extension is deactivated)
	public static dispose(): void {
		if (KaotoOutputChannel.instance) {
			KaotoOutputChannel.instance.dispose();
		}
	}
}
