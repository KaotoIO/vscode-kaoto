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
	private static readonly REDHAT_MAVEN_BASE = 'https://maven.repository.redhat.com/ga/org/apache/camel/camel-launcher';
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

		// Try to find existing executable
		let launcherExecutable = this.findLauncherExecutable(launcherDir);
		if (launcherExecutable) {
			KaotoOutputChannel.logInfo(`Camel Launcher ${version} already available at: ${launcherExecutable}`);
			return launcherExecutable;
		}

		// Download and extract
		KaotoOutputChannel.logInfo(`Downloading Camel Launcher ${version}...`);
		await this.downloadLauncher(version, launcherDir);

		// Find the executable after extraction
		launcherExecutable = this.findLauncherExecutable(launcherDir);
		if (!launcherExecutable) {
			throw new Error(`Camel Launcher executable not found after extraction in ${launcherDir}`);
		}

		// Make all scripts in bin directory executable on Unix systems
		if (process.platform !== 'win32') {
			this.makeScriptsExecutable(launcherDir);
		}

		KaotoOutputChannel.logInfo(`Camel Launcher ${version} ready at: ${launcherExecutable}`);
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
	 * Download Camel Launcher from appropriate Maven repository (Maven Central or RedHat)
	 */
	private async downloadLauncher(version: string, targetDir: string): Promise<void> {
		const zipPath = path.join(this.storageDir, `camel-launcher-${version}.zip`);
		const mavenBaseUrl = this.getMavenBaseUrl(version);

		// Try different possible artifact names
		const urlPatterns = [`${mavenBaseUrl}/${version}/camel-launcher-${version}-bin.zip`, `${mavenBaseUrl}/${version}/camel-launcher-${version}.zip`];

		let lastError: Error | undefined;

		for (const downloadUrl of urlPatterns) {
			try {
				KaotoOutputChannel.logInfo(`Trying download URL: ${downloadUrl}`);

				// Download zip file
				await this.downloadFile(downloadUrl, zipPath);

				// Extract zip
				await this.extractZip(zipPath, targetDir);

				// Clean up zip file
				fs.unlinkSync(zipPath);

				return; // Success!
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				KaotoOutputChannel.logWarning(`Failed to download from ${downloadUrl}: ${lastError.message}`);

				// Clean up failed download
				if (fs.existsSync(zipPath)) {
					fs.unlinkSync(zipPath);
				}
			}
		}

		// All attempts failed
		throw new Error(`Failed to download Camel Launcher ${version} from any URL. Last error: ${lastError?.message}`);
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
	 * Extract zip file and flatten nested directory structure
	 */
	private async extractZip(zipPath: string, targetDir: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!fs.existsSync(targetDir)) {
				fs.mkdirSync(targetDir, { recursive: true });
			}

			// Extract to temporary directory first
			const tempDir = path.join(this.storageDir, `temp-${Date.now()}`);
			fs.mkdirSync(tempDir, { recursive: true });

			fs.createReadStream(zipPath)
				.pipe(Extract({ path: tempDir }))
				.on('close', () => {
					try {
						// Find the actual content directory (handles nested structure)
						this.flattenExtractedContent(tempDir, targetDir);

						// Clean up temp directory
						fs.rmSync(tempDir, { recursive: true, force: true });
						resolve();
					} catch (error) {
						reject(error);
					}
				})
				.on('error', reject);
		});
	}

	/**
	 * Flatten extracted content by moving files from nested directory to target
	 */
	private flattenExtractedContent(tempDir: string, targetDir: string): void {
		const entries = fs.readdirSync(tempDir, { withFileTypes: true });

		// If there's a single directory, use its contents
		if (entries.length === 1 && entries[0].isDirectory()) {
			const nestedDir = path.join(tempDir, entries[0].name);
			this.moveDirectoryContents(nestedDir, targetDir);
		} else {
			// Otherwise move everything directly
			this.moveDirectoryContents(tempDir, targetDir);
		}
	}

	/**
	 * Move all contents from source to target directory
	 */
	private moveDirectoryContents(sourceDir: string, targetDir: string): void {
		const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

		for (const entry of entries) {
			const sourcePath = path.join(sourceDir, entry.name);
			const targetPath = path.join(targetDir, entry.name);

			if (entry.isDirectory()) {
				fs.mkdirSync(targetPath, { recursive: true });
				this.moveDirectoryContents(sourcePath, targetPath);
			} else {
				fs.copyFileSync(sourcePath, targetPath);
			}
		}
	}

	/**
	 * Make all scripts in bin directory executable
	 */
	private makeScriptsExecutable(launcherDir: string): void {
		const binDir = this.findBinDirectory(launcherDir);
		if (!binDir) {
			KaotoOutputChannel.logWarning('Could not find bin directory to set execute permissions');
			return;
		}

		try {
			const files = fs.readdirSync(binDir);
			for (const file of files) {
				const filePath = path.join(binDir, file);
				if (fs.statSync(filePath).isFile()) {
					fs.chmodSync(filePath, 0o755);
					KaotoOutputChannel.logInfo(`Set execute permission for: ${filePath}`);
				}
			}
		} catch (error) {
			KaotoOutputChannel.logWarning(`Failed to set execute permissions: ${error}`);
		}
	}

	/**
	 * Find bin directory in launcher directory
	 */
	private findBinDirectory(launcherDir: string): string | null {
		const searchDir = (dir: string, depth: number = 0): string | null => {
			if (depth > 3) {
				return null;
			}

			try {
				const entries = fs.readdirSync(dir, { withFileTypes: true });
				for (const entry of entries) {
					if (entry.isDirectory() && entry.name === 'bin') {
						return path.join(dir, entry.name);
					}
					if (entry.isDirectory()) {
						const found = searchDir(path.join(dir, entry.name), depth + 1);
						if (found) {
							return found;
						}
					}
				}
			} catch (error) {
				// Ignore errors
			}
			return null;
		};

		return searchDir(launcherDir);
	}

	/**
	 * Get launcher directory for specific version
	 */
	private getLauncherDirectory(version: string): string {
		return path.join(this.storageDir, `camel-launcher-${version}`);
	}

	/**
	 * Find launcher executable by searching the directory tree
	 */
	private findLauncherExecutable(launcherDir: string): string | null {
		if (!fs.existsSync(launcherDir)) {
			return null;
		}

		const isWindows = process.platform === 'win32';
		// Try multiple possible executable names
		const executableNames = isWindows ? ['camel.bat', 'camel.cmd'] : ['camel.sh', 'camel'];

		// Search for bin/camel or bin/camel.bat recursively
		const searchDir = (dir: string, depth: number = 0): string | null => {
			if (depth > 3) {
				return null;
			} // Limit recursion depth

			try {
				const entries = fs.readdirSync(dir, { withFileTypes: true });

				for (const entry of entries) {
					const fullPath = path.join(dir, entry.name);

					if (entry.isDirectory()) {
						// Check if this is a bin directory
						if (entry.name === 'bin') {
							// Try each possible executable name
							for (const execName of executableNames) {
								const execPath = path.join(fullPath, execName);
								if (fs.existsSync(execPath)) {
									return execPath;
								}
							}
						}
						// Recurse into subdirectories
						const found = searchDir(fullPath, depth + 1);
						if (found) {
							return found;
						}
					}
				}
			} catch (error) {
				// Ignore errors reading directories
			}

			return null;
		};

		return searchDir(launcherDir);
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
