import { assert } from 'chai';
import * as vscode from 'vscode';
import { CamelExecutorFactory } from '../../executors/CamelExecutorFactory';
import { JBangExecutor } from '../../executors/JBangExecutor';
import { CamelLauncherExecutor } from '../../executors/CamelLauncherExecutor';
import { initializeKaotoCatalogService } from '../helpers/TestSetup';

suite('CamelExecutorFactory Tests', () => {
	let originalConfig: vscode.WorkspaceConfiguration;

	suiteSetup(async () => {
		// Initialize KaotoCatalogService for tests
		await initializeKaotoCatalogService();

		// Store original configuration
		originalConfig = vscode.workspace.getConfiguration();
	});

	suiteTeardown(() => {
		// Restore original configuration
		originalConfig.update('kaoto.executor.type', undefined, vscode.ConfigurationTarget.Global);
	});

	test('Should create JBangExecutor when type is jbang', async () => {
		await vscode.workspace.getConfiguration().update('kaoto.executor.type', 'jbang', vscode.ConfigurationTarget.Global);

		const executor = await CamelExecutorFactory.createExecutor();

		assert.instanceOf(executor, JBangExecutor);
	});

	test('Should create CamelLauncherExecutor when type is camel-launcher', async () => {
		await vscode.workspace.getConfiguration().update('kaoto.executor.type', 'camel-launcher', vscode.ConfigurationTarget.Global);

		const executor = await CamelExecutorFactory.createExecutor();

		assert.instanceOf(executor, CamelLauncherExecutor);
	});

	test('Should use jbang as default when no type specified', async () => {
		await vscode.workspace.getConfiguration().update('kaoto.executor.type', undefined, vscode.ConfigurationTarget.Global);

		const executor = await CamelExecutorFactory.createExecutor();

		assert.instanceOf(executor, JBangExecutor);
	});

	test('Should check if executor is available', async () => {
		await vscode.workspace.getConfiguration().update('kaoto.executor.type', 'jbang', vscode.ConfigurationTarget.Global);

		const executor = await CamelExecutorFactory.createExecutor();
		const isAvailable = await executor.isAvailable();

		// JBang availability depends on system installation
		assert.isBoolean(isAvailable);
	});

	suiteTeardown(async () => {
		// Restore original configuration
		await vscode.workspace.getConfiguration().update('kaoto.executor.type', undefined, vscode.ConfigurationTarget.Global);
	});
});
