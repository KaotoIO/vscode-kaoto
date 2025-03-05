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
import { window } from 'vscode';

/**
 * Shows a modal asking for user confirmation of a potential file deletion.
 * VS Code automatically provides a 'Cancel' option which return `undefined`.
 *
 * @returns string | undefined
 */
export async function confirmFileDeleteDialog(filename: string) {
	const message = `Are you sure you want to delete '${filename}'?`;
	const continueOption = 'Delete';
	return await window.showWarningMessage(message, { modal: true }, continueOption);
}
