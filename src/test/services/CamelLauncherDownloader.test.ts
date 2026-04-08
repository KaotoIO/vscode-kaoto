import { assert } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import { CamelLauncherDownloader } from '../../services/CamelLauncherDownloader';

suite('CamelLauncherDownloader Tests', () => {
	let downloader: CamelLauncherDownloader;
	let testStoragePath: string;

	setup(() => {
		// Create a temporary storage path for testing
		testStoragePath = path.join(__dirname, '..', '..', '..', 'test-storage');
		if (!fs.existsSync(testStoragePath)) {
			fs.mkdirSync(testStoragePath, { recursive: true });
		}
		// Pass undefined for context and use custom storage dir
		downloader = new CamelLauncherDownloader(undefined, testStoragePath);
	});

	teardown(() => {
		// Cleanup test storage
		if (fs.existsSync(testStoragePath)) {
			fs.rmSync(testStoragePath, { recursive: true, force: true });
		}
	});

	test('Should get storage directory', () => {
		const storageDir = downloader.getStorageDirectory();

		assert.equal(storageDir, testStoragePath);
	});

	test('Should create storage directory if it does not exist', () => {
		const newStoragePath = path.join(__dirname, '..', '..', '..', 'new-test-storage');

		// Remove if exists
		if (fs.existsSync(newStoragePath)) {
			fs.rmSync(newStoragePath, { recursive: true, force: true });
		}

		const newDownloader = new CamelLauncherDownloader(undefined, newStoragePath);

		// Storage path should be created
		assert.isTrue(fs.existsSync(newStoragePath));
		assert.equal(newDownloader.getStorageDirectory(), newStoragePath);

		// Cleanup
		fs.rmSync(newStoragePath, { recursive: true, force: true });
	});

	test('Should return cached path if launcher already exists', async () => {
		const version = '4.18.0';
		const launcherDir = path.join(testStoragePath, `camel-launcher-${version}`);

		// Create the directory structure
		const binDir = path.join(launcherDir, 'bin');
		fs.mkdirSync(binDir, { recursive: true });

		const execName = process.platform === 'win32' ? 'camel.cmd' : 'camel';
		const execPath = path.join(binDir, execName);
		fs.writeFileSync(execPath, '#!/bin/bash\necho "test"');

		// Should return cached path without downloading
		const result = await downloader.ensureLauncher(version);

		assert.equal(result, execPath);
	});

	test('Should find launcher executable in bin directory', async () => {
		const version = '4.18.0';
		const launcherDir = path.join(testStoragePath, `camel-launcher-${version}`);

		// Create the directory structure with bin/camel
		const binDir = path.join(launcherDir, 'bin');
		fs.mkdirSync(binDir, { recursive: true });

		const execName = process.platform === 'win32' ? 'camel.cmd' : 'camel';
		const execPath = path.join(binDir, execName);
		fs.writeFileSync(execPath, '#!/bin/bash\necho "test"');

		// Should find the executable
		const result = await downloader.ensureLauncher(version);

		assert.equal(result, execPath);
		assert.isTrue(fs.existsSync(result));
	});

	test('Should handle nested directory structure', async () => {
		const version = '4.18.0';
		const launcherDir = path.join(testStoragePath, `camel-launcher-${version}`);

		// Create nested structure: camel-launcher-4.18.0/nested/bin/camel
		const nestedDir = path.join(launcherDir, 'nested');
		const binDir = path.join(nestedDir, 'bin');
		fs.mkdirSync(binDir, { recursive: true });

		const execName = process.platform === 'win32' ? 'camel.cmd' : 'camel';
		const execPath = path.join(binDir, execName);
		fs.writeFileSync(execPath, '#!/bin/bash\necho "test"');

		// Should find the executable even in nested structure
		const result = await downloader.ensureLauncher(version);

		assert.equal(result, execPath);
		assert.isTrue(fs.existsSync(result));
	});

	test('Should cleanup old versions', async () => {
		// Create multiple version directories
		const version1 = '4.17.0';
		const version2 = '4.18.0';

		const dir1 = path.join(testStoragePath, `camel-launcher-${version1}`);
		const dir2 = path.join(testStoragePath, `camel-launcher-${version2}`);

		fs.mkdirSync(dir1, { recursive: true });
		fs.mkdirSync(dir2, { recursive: true });

		// Cleanup old versions, keeping version2
		await downloader.cleanupOldVersions(version2);

		// version1 should be removed, version2 should remain
		assert.isFalse(fs.existsSync(dir1));
		assert.isTrue(fs.existsSync(dir2));
	});

	test('Should cleanup all versions when no version specified', async () => {
		// Create multiple version directories
		const version1 = '4.17.0';
		const version2 = '4.18.0';

		const dir1 = path.join(testStoragePath, `camel-launcher-${version1}`);
		const dir2 = path.join(testStoragePath, `camel-launcher-${version2}`);

		fs.mkdirSync(dir1, { recursive: true });
		fs.mkdirSync(dir2, { recursive: true });

		// Cleanup all versions
		await downloader.cleanupOldVersions();

		// Both should be removed
		assert.isFalse(fs.existsSync(dir1));
		assert.isFalse(fs.existsSync(dir2));
	});

	test('Should handle missing launcher directory gracefully', async () => {
		const version = '999.999.999';
		const launcherDir = path.join(testStoragePath, `camel-launcher-${version}`);

		// Ensure directory doesn't exist
		if (fs.existsSync(launcherDir)) {
			fs.rmSync(launcherDir, { recursive: true, force: true });
		}

		try {
			// This should attempt to download, which will fail for invalid version
			await downloader.ensureLauncher(version);
			assert.fail('Should have thrown an error');
		} catch (error) {
			assert.instanceOf(error, Error);
			assert.include((error as Error).message, 'Failed to download');
		}
	});

	test('Should prefer camel.cmd on Windows and camel on Unix', async () => {
		const version = '4.18.0';
		const launcherDir = path.join(testStoragePath, `camel-launcher-${version}`);
		const binDir = path.join(launcherDir, 'bin');
		fs.mkdirSync(binDir, { recursive: true });

		// Create both executables
		const camelPath = path.join(binDir, 'camel');
		const camelCmdPath = path.join(binDir, 'camel.cmd');
		fs.writeFileSync(camelPath, '#!/bin/bash\necho "test"');
		fs.writeFileSync(camelCmdPath, '@echo off\necho "test"');

		const result = await downloader.ensureLauncher(version);

		// Should prefer platform-specific executable
		if (process.platform === 'win32') {
			assert.equal(result, camelCmdPath);
		} else {
			assert.equal(result, camelPath);
		}

		test('Should detect RedHat build versions', () => {
			// Access private method through any cast for testing
			const downloaderAny = downloader as any;

			assert.isTrue(downloaderAny.isRedHatBuild('4.14.2.redhat-00006'));
			assert.isTrue(downloaderAny.isRedHatBuild('4.14.2.redhat-00019'));
			assert.isFalse(downloaderAny.isRedHatBuild('4.18.0'));
			assert.isFalse(downloaderAny.isRedHatBuild('4.14.5'));
		});

		test('Should use RedHat Maven repository for RedHat builds', () => {
			// Access private method through any cast for testing
			const downloaderAny = downloader as any;

			const redhatUrl = downloaderAny.getMavenBaseUrl('4.14.2.redhat-00006');
			const communityUrl = downloaderAny.getMavenBaseUrl('4.18.0');

			assert.include(redhatUrl, 'maven.repository.redhat.com');
			assert.include(communityUrl, 'repo1.maven.org');
		});
	});
});
