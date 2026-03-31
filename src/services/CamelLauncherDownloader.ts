import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as os from 'os';
import { ExtensionContext } from 'vscode';
import { KaotoOutputChannel } from '../extension/KaotoOutputChannel';
import { Extract } from 'unzipper';

/**
 * Service for downloading and managing Camel Launcher distributions
 */
export class CamelLauncherDownloader {
	private static readonly MAVEN_CENTRAL_BASE = 'https://repo1.maven.org/maven2/org/apache/camel/camel-launcher';
	private readonly storageDir: string;

	constructor(context?: ExtensionContext, customStorageDir?: string) {
		// Use custom storage dir, extension global storage, or fallback to temp
		this.storageDir = customStorageDir || context?.globalStorageUri.fsPath || path.join(os.tmpdir(), 'vscode-kaoto-camel-launcher');

		// Ensure storage directory exists
		if (!fs.existsSync(this.storageDir)) {
			fs.mkdirSync(this.storageDir, { recursive: true });
		}
	}

	/**
	 * Ensure Camel Launcher is available, downloading if necessary
	 * @param version - Camel version to download
	 * @returns Path to the camel launcher executable
	 */
	async ensureLauncher(version: string): Promise<string> {
		const launcherDir = this.getLauncherDirectory(version);
		const launcherExecutable = this.getLauncherExecutable(launcherDir);

		// Check if already downloaded
		if (fs.existsSync(launcherExecutable)) {
			KaotoOutputChannel.logInfo(`Camel Launcher ${version} already available at: ${launcherExecutable}`);
			return launcherExecutable;
		}

		// Download and extract
		KaotoOutputChannel.logInfo(`Downloading Camel Launcher ${version}...`);
		await this.downloadLauncher(version, launcherDir);

		// Make executable on Unix systems
		if (process.platform !== 'win32') {
			fs.chmodSync(launcherExecutable, 0o755);
		}

		KaotoOutputChannel.logInfo(`Camel Launcher ${version} ready at: ${launcherExecutable}`);
		return launcherExecutable;
	}

	/**
	 * Download Camel Launcher from Maven Central
	 */
	private async downloadLauncher(version: string, targetDir: string): Promise<void> {
		const downloadUrl = this.getDownloadUrl(version);
		const zipPath = path.join(this.storageDir, `camel-launcher-${version}.zip`);

		try {
			// Download zip file
			await this.downloadFile(downloadUrl, zipPath);

			// Extract zip
			await this.extractZip(zipPath, targetDir);

			// Clean up zip file
			fs.unlinkSync(zipPath);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to download Camel Launcher ${version}: ${errorMessage}`);
		}
	}

	/**
	 * Download file from URL
	 */
	private downloadFile(url: string, targetPath: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const file = fs.createWriteStream(targetPath);

			https
				.get(url, (response) => {
					// Handle redirects
					if (response.statusCode === 301 || response.statusCode === 302) {
						const redirectUrl = response.headers.location;
						if (redirectUrl) {
							file.close();
							fs.unlinkSync(targetPath);
							this.downloadFile(redirectUrl, targetPath).then(resolve).catch(reject);
							return;
						}
					}

					if (response.statusCode !== 200) {
						file.close();
						fs.unlinkSync(targetPath);
						reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
						return;
					}

					response.pipe(file);

					file.on('finish', () => {
						file.close();
						resolve();
					});
				})
				.on('error', (error) => {
					file.close();
					if (fs.existsSync(targetPath)) {
						fs.unlinkSync(targetPath);
					}
					reject(error);
				});
		});
	}

	/**
	 * Extract zip file
	 */
	private extractZip(zipPath: string, targetDir: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!fs.existsSync(targetDir)) {
				fs.mkdirSync(targetDir, { recursive: true });
			}

			fs.createReadStream(zipPath)
				.pipe(Extract({ path: targetDir }))
				.on('close', resolve)
				.on('error', reject);
		});
	}

	/**
	 * Get download URL for specific version
	 */
	private getDownloadUrl(version: string): string {
		return `${CamelLauncherDownloader.MAVEN_CENTRAL_BASE}/${version}/camel-launcher-${version}.zip`;
	}

	/**
	 * Get launcher directory for specific version
	 */
	private getLauncherDirectory(version: string): string {
		return path.join(this.storageDir, `camel-launcher-${version}`);
	}

	/**
	 * Get launcher executable path
	 */
	private getLauncherExecutable(launcherDir: string): string {
		const isWindows = process.platform === 'win32';
		const executable = isWindows ? 'camel.bat' : 'camel';
		return path.join(launcherDir, 'bin', executable);
	}

	/**
	 * Clean up old launcher versions
	 */
	async cleanupOldVersions(keepVersion?: string): Promise<void> {
		const entries = fs.readdirSync(this.storageDir);

		for (const entry of entries) {
			const fullPath = path.join(this.storageDir, entry);

			// Skip if it's the version we want to keep
			if (keepVersion && entry === `camel-launcher-${keepVersion}`) {
				continue;
			}

			// Remove old launcher directories
			if (entry.startsWith('camel-launcher-') && fs.statSync(fullPath).isDirectory()) {
				fs.rmSync(fullPath, { recursive: true, force: true });
				KaotoOutputChannel.logInfo(`Cleaned up old Camel Launcher: ${entry}`);
			}
		}
	}

	/**
	 * Get storage directory
	 */
	getStorageDirectory(): string {
		return this.storageDir;
	}
}
