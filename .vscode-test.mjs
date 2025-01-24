import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	workspaceFolder: './test-WorkspaceWithAYamlFile',
	launchArgs: ['--verbose'],
	mocha: {
		ui: 'tdd',
		color: true,
		timeout: 100000,
		reporter: 'mocha-jenkins-reporter'
	}
});
