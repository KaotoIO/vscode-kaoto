import { defineConfig } from '@vscode/test-cli';
import path from 'path';
import os from 'os';

const launchArgs = process.env.CI ? [] : ['--user-data-dir', path.join(os.tmpdir(), 'vscode-kaoto-test')];

export default defineConfig({
	files: 'out/test/**/*.test.js',
	workspaceFolder: path.resolve('.vscode/test-workspace.code-workspace'),
	launchArgs,
	mocha: {
		ui: 'tdd',
		color: true,
		timeout: 100000,
		reporter: 'mocha-jenkins-reporter',
	},
});
