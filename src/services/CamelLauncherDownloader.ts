import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as os from 'os';
import { ExtensionContext } from 'vscode';
import { KaotoOutputChannel } from '../extension/KaotoOutputChannel';

/**
 * Service for downloading and managing Camel Launcher JAR distributions
 */
export class CamelLauncherDownloader {
	private static readonly MAVEN_CENTRAL_BASE = 'https://repo1.maven.org/maven2/org/apache/camel/camel-launcher';
	private static readonly REDHAT_MAVEN_BASE = 'https://maven.repository.redhat.com/ga/org/apache/camel/camel-launcher';
	private readonly storageDir: string;
	private readonly extensionPath: string;

	constructor(context?: ExtensionContext, customStorageDir?: string) {
		// Use custom storage dir, extension global storage, or fallback to temp
		this.storageDir = customStorageDir || context?.globalStorageUri.fsPath || path.join(os.tmpdir(), 'vscode-kaoto-camel-launcher');

		// Store extension path for accessing bundled resources
		this.extensionPath = context?.extensionPath || '';

		// Ensure storage directory exists
		if (!fs.existsSync(this.storageDir)) {
			fs.mkdirSync(this.storageDir, { recursive: true });
		}
	}

	/**
	 * Ensure Camel Launcher is available, downloading if necessary
	 * @param version - Camel version to download
	 * @returns Path to the camel launcher executable script
	 */
	async ensureLauncher(version: string): Promise<string> {
		const launcherDir = this.getLauncherDirectory(version);

		// Try to find existing executable
		let launcherExecutable = this.findLauncherExecutable(launcherDir);
		if (launcherExecutable) {
			KaotoOutputChannel.logInfo(`Camel Launcher ${version} already available at: ${launcherExecutable}`);
			return launcherExecutable;
		}

		// Download JAR and setup scripts
		KaotoOutputChannel.logInfo(`Downloading Camel Launcher ${version}...`);
		await this.downloadLauncher(version, launcherDir);

		// Find the executable after setup
		launcherExecutable = this.findLauncherExecutable(launcherDir);
		if (!launcherExecutable) {
			throw new Error(`Camel Launcher executable not found after setup in ${launcherDir}`);
		}

		// Make script executable on Unix systems
		if (process.platform !== 'win32') {
			fs.chmodSync(launcherExecutable, 0o755);
			KaotoOutputChannel.logInfo(`Set execute permission for: ${launcherExecutable}`);
		}

		return launcherExecutable;
	}

	/**
	 * Check if version is a RedHat build
	 */
	private isRedHatBuild(version: string): boolean {
		return version.includes('.redhat-');
	}

	/**
	 * Get Maven repository base URL for the version
	 */
	private getMavenBaseUrl(version: string): string {
		return this.isRedHatBuild(version) ? CamelLauncherDownloader.REDHAT_MAVEN_BASE : CamelLauncherDownloader.MAVEN_CENTRAL_BASE;
	}

	/**
	 * Download Camel Launcher JAR from appropriate Maven repository and setup scripts
	 */
	private async downloadLauncher(version: string, targetDir: string): Promise<void> {
		const jarPath = path.join(targetDir, `camel-launcher-${version}.jar`);
		const mavenBaseUrl = this.getMavenBaseUrl(version);

		// Ensure target directory exists
		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		// Download JAR file
		const downloadUrl = `${mavenBaseUrl}/${version}/camel-launcher-${version}.jar`;

		try {
			KaotoOutputChannel.logInfo(`Downloading JAR from: ${downloadUrl}`);
			await this.downloadFile(downloadUrl, jarPath);
			KaotoOutputChannel.logInfo(`JAR downloaded successfully to: ${jarPath}`);
		} catch (error) {
			throw new Error(`Failed to download Camel Launcher ${version} from ${downloadUrl}: ${error instanceof Error ? error.message : String(error)}`);
		}

		// Copy launcher scripts from extension resources
		await this.setupLauncherScripts(targetDir);
	}

	/**
	 * Copy launcher scripts from extension resources to target directory
	 */
	private async setupLauncherScripts(targetDir: string): Promise<void> {
		const resourcesDir = path.join(this.extensionPath, 'resources', 'camel-launcher');

		// Copy camel.sh for Unix systems
		const shScriptSource = path.join(resourcesDir, 'camel.sh');
		const shScriptTarget = path.join(targetDir, 'camel.sh');

		if (fs.existsSync(shScriptSource)) {
			fs.copyFileSync(shScriptSource, shScriptTarget);
			KaotoOutputChannel.logInfo(`Copied camel.sh to: ${shScriptTarget}`);
		} else {
			KaotoOutputChannel.logWarning(`camel.sh not found at: ${shScriptSource}`);
		}

		// Copy camel.bat for Windows
		const batScriptSource = path.join(resourcesDir, 'camel.bat');
		const batScriptTarget = path.join(targetDir, 'camel.bat');

		if (fs.existsSync(batScriptSource)) {
			fs.copyFileSync(batScriptSource, batScriptTarget);
			KaotoOutputChannel.logInfo(`Copied camel.bat to: ${batScriptTarget}`);
		} else {
			KaotoOutputChannel.logWarning(`camel.bat not found at: ${batScriptSource}`);
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
	 * Get launcher directory for specific version
	 */
	private getLauncherDirectory(version: string): string {
		return path.join(this.storageDir, `camel-launcher-${version}`);
	}

	/**
	 * Find launcher executable script in the directory
	 */
	private findLauncherExecutable(launcherDir: string): string | null {
		if (!fs.existsSync(launcherDir)) {
			return null;
		}

		const isWindows = process.platform === 'win32';
		const scriptName = isWindows ? 'camel.bat' : 'camel.sh';
		const scriptPath = path.join(launcherDir, scriptName);

		if (fs.existsSync(scriptPath)) {
			return scriptPath;
		}

		return null;
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
