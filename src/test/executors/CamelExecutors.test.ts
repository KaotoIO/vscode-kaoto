import { assert } from 'chai';
import { JBangExecutor } from '../../executors/JBangExecutor';
import { CamelLauncherExecutor } from '../../executors/CamelLauncherExecutor';
import * as path from 'path';
import * as fs from 'fs';

suite('Executor Implementation Tests', () => {
	suite('JBangExecutor Tests', () => {
		let executor: JBangExecutor;

		setup(() => {
			executor = new JBangExecutor({
				type: 'jbang',
				version: '4.18.0',
				jbangPath: 'jbang',
			});
		});

		test('Should have correct configuration', () => {
			const config = executor.getConfig();
			assert.equal(config.type, 'jbang');
			assert.equal(config.version, '4.18.0');
		});

		test('Should get version from config', () => {
			assert.equal(executor.getVersion(), '4.18.0');
		});

		test('Should check availability', async () => {
			// This will check if jbang is actually installed
			const isAvailable = await executor.isAvailable();

			// We can't assert true/false as it depends on the environment
			// Just verify it returns a boolean
			assert.isBoolean(isAvailable);
		});

		test('Should execute run command', async () => {
			try {
				const result = await executor.execute('run', ['/path/to/file.yaml', '--console'], {
					cwd: '/workspace',
				});

				// Should return a CommandResult with execution
				assert.isDefined(result.execution);
			} catch (error) {
				// Expected if jbang is not available
				assert.include((error as Error).message, 'not available');
			}
		});

		test('Should execute export command', async () => {
			try {
				const result = await executor.execute('export', ['--runtime=quarkus'], {
					cwd: '/workspace',
				});

				// Should return a CommandResult with execution
				assert.isDefined(result.execution);
			} catch (error) {
				// Expected if jbang is not available
				assert.include((error as Error).message, 'not available');
			}
		});

		test('Should execute init command', async () => {
			try {
				const result = await executor.execute('init', ['com.example:my-app:1.0.0'], {
					cwd: '/workspace',
				});

				// Should return a CommandResult with execution
				assert.isDefined(result.execution);
			} catch (error) {
				// Expected if jbang is not available
				assert.include((error as Error).message, 'not available');
			}
		});
	});

	suite('CamelLauncherExecutor Tests', () => {
		let executor: CamelLauncherExecutor;
		let testLauncherPath: string;

		setup(() => {
			// Create a mock launcher executable for testing
			const testDir = path.join(__dirname, '..', '..', '..', 'test-launcher');
			if (!fs.existsSync(testDir)) {
				fs.mkdirSync(testDir, { recursive: true });
			}

			testLauncherPath = path.join(testDir, process.platform === 'win32' ? 'camel.cmd' : 'camel');
			fs.writeFileSync(testLauncherPath, '#!/bin/bash\necho "test"');

			if (process.platform !== 'win32') {
				fs.chmodSync(testLauncherPath, 0o755);
			}

			executor = new CamelLauncherExecutor(
				{
					type: 'camel-launcher',
					version: '4.18.0',
				},
				testLauncherPath,
			);
		});

		teardown(() => {
			// Cleanup test launcher
			const testDir = path.join(__dirname, '..', '..', '..', 'test-launcher');
			if (fs.existsSync(testDir)) {
				fs.rmSync(testDir, { recursive: true, force: true });
			}
		});

		test('Should have correct configuration', () => {
			const config = executor.getConfig();
			assert.equal(config.type, 'camel-launcher');
			assert.equal(config.version, '4.18.0');
		});

		test('Should get version from config', () => {
			assert.equal(executor.getVersion(), '4.18.0');
		});

		test('Should be available when launcher path exists', async () => {
			const isAvailable = await executor.isAvailable();

			// Should be available since we created the file
			assert.isTrue(isAvailable);
		});

		test('Should not be available when launcher path does not exist', async () => {
			const nonExistentExecutor = new CamelLauncherExecutor(
				{
					type: 'camel-launcher',
					version: '4.18.0',
				},
				'/non/existent/path/camel',
			);

			const isAvailable = await nonExistentExecutor.isAvailable();

			// Should not be available
			assert.isFalse(isAvailable);
		});

		test('Should execute run command', async () => {
			const result = await executor.execute('run', ['/path/to/file.yaml', '--console'], {
				cwd: '/workspace',
			});

			// Should return a CommandResult with execution
			assert.isDefined(result.execution);
		});

		test('Should execute export command', async () => {
			const result = await executor.execute('export', ['--runtime=quarkus'], {
				cwd: '/workspace',
			});

			// Should return a CommandResult with execution
			assert.isDefined(result.execution);
		});

		test('Should execute kubernetes command', async () => {
			const result = await executor.execute('kubernetes', ['run', '/path/to/file.yaml'], {
				cwd: '/workspace',
			});

			// Should return a CommandResult with execution
			assert.isDefined(result.execution);
		});

		test('Should execute init command', async () => {
			const result = await executor.execute('init', ['com.example:my-app:1.0.0'], {
				cwd: '/workspace',
			});

			// Should return a CommandResult with execution
			assert.isDefined(result.execution);
		});

		test('Should execute bind command', async () => {
			const result = await executor.execute('bind', ['source', 'sink', '--output=pipe.yaml'], {
				cwd: '/workspace',
			});

			// Should return a CommandResult with execution
			assert.isDefined(result.execution);
		});

		test('Should execute stop command', async () => {
			const result = await executor.execute('stop', ['my-route'], {
				cwd: '/workspace',
			});

			// Should return a CommandResult with execution
			assert.isDefined(result.execution);
		});

		test('Should execute dependency command', async () => {
			const result = await executor.execute('dependency', ['update', '/path/to/file.yaml'], {
				cwd: '/workspace',
			});

			// Should return a CommandResult with execution
			assert.isDefined(result.execution);
		});

		test('Should execute cmd command', async () => {
			const result = await executor.execute('cmd', ['route-start', 'my-route'], {
				cwd: '/workspace',
			});

			// Should return a CommandResult with execution
			assert.isDefined(result.execution);
		});

		test('Should execute plugin command', async () => {
			const result = await executor.execute('plugin', ['add', 'my-plugin'], {
				cwd: '/workspace',
			});

			// Should return a CommandResult with execution
			assert.isDefined(result.execution);
		});

		test('Should throw error when executor is not available', async () => {
			const nonExistentExecutor = new CamelLauncherExecutor(
				{
					type: 'camel-launcher',
					version: '4.18.0',
				},
				'/non/existent/path/camel',
			);

			try {
				await nonExistentExecutor.execute('run', ['/path/to/file.yaml']);
				assert.fail('Should have thrown an error');
			} catch (error) {
				assert.include((error as Error).message, 'not available');
			}
		});
	});
});
