import { defineConfig } from '@vscode/test-cli';
import path from 'path';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	workspaceFolder: path.resolve('.vscode/test-workspace.code-workspace'),
	mocha: {
		ui: 'tdd',
		color: true,
		timeout: 100000,
		reporter: 'mocha-jenkins-reporter',
	},
});
