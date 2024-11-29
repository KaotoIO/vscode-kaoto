import { window } from 'vscode';

/**
 * Shows a modal asking for user confirmation of a potential file deletion.
 * VSCode automatically provides a 'Cancel' option which return `undefined`. The continue option will return the string `Continue`.
 *
 * @returns string | undefined
 */
export async function confirmFileDeleteDialog(filename: string) {
	const message = `Are you sure you want to delete '${filename}'?`;
	const continueOption = 'Move to Trash';

	return await window.showWarningMessage(message, { modal: true, detail: 'You can restore this file from the Trash.' }, continueOption);
}

