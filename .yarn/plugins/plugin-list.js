// Workaround for https://github.com/microsoft/vscode-vsce/issues/517
// taken from https://gist.githubusercontent.com/arendjr/415747652a8c79f12b005ce3cfb2f808/raw/a4a227070319e1d4c61e982b74153765d6338694/list-plugin.js

const fs = require('fs');

// Setup: Place this file in `.yarn/plugins/list-plugin.js` and the following
// to `.yarnrc.yml`:
//
// ```
// plugins:
//  - path: .yarn/plugins/plugin-list.js
// ```
module.exports = {
  name: 'plugin-list',
  factory: (require) => {
    const { BaseCommand } = require('@yarnpkg/cli');
    const { Command, Option } = require('clipanion');
    const { parseSyml } = require('@yarnpkg/parsers');
    const { Manifest } = require('@yarnpkg/core');

    class ListCommand extends BaseCommand {
      static paths = [['list']];

      static usage = Command.Usage({
        description: 'Lists installed packages.',
      });

      prod = Option.Boolean('--prod', false);
      json = Option.Boolean('--json', false);
      manifest = new Manifest();
      trees = [];

      async execute() {
        await this.manifest.loadFile(Manifest.fileName, {});

        if (!this.prod || !this.json) {
          throw new Error(
            'This command can only be used with the --prod and --json ' +
              'args to match the behavior required by VSCE. See: ' +
              'https://github.com/microsoft/vscode-vsce/blob/main/src/npm.ts'
          );
        }

        const packageJsonContents = fs.readFileSync('package.json', 'utf-8');
        const { dependencies, resolutions } = JSON.parse(packageJsonContents);

        const lockContents = fs.readFileSync('yarn.lock', 'utf-8');
        const resolved = parseSyml(lockContents);

        this.addDependencies(dependencies, resolved, resolutions);

        const output = {
          type: 'tree',
          data: { type: 'list', trees: this.trees },
        };

        this.context.stdout.write(JSON.stringify(output));
      }

      addDependencies(dependencies, resolved, resolutions) {
        for (const [packageName, versionSpecifier] of Object.entries(dependencies)) {
          this.addDependency(packageName, versionSpecifier, resolved, resolutions);
        }
      }

      addDependency(packageName, versionSpecifier, resolved, resolutions) {
        const packageInfo = this.lookup(resolved, packageName, versionSpecifier, resolutions);
        if (!packageInfo) {
          throw new Error(
            `Cannot resolve "${packageName}" with version range "${versionSpecifier}"`
          );
        }

        const { version, dependencies } = packageInfo;
        const name = `${packageName}@${version}`;
        if (this.trees.find((tree) => tree.name === name)) {
          return; // Dependency already added as part of another tree.
        }

        if (dependencies) {
          const children = Object.entries(dependencies).map(([name, range]) => ({
            name: `${name}@${range}`,
          }));
          this.trees.push({ name, children });

          this.addDependencies(dependencies, resolved, resolutions);
        } else {
          this.trees.push({ name, children: [] });
        }
      }

      /**
       * @param resolved All the resolved dependencies as found in the lock file.
       * @param packageName The package name to look up.
       * @param versionSpecifier The package version range as declared in the package.json.
       * @param resolutions The resolutions override as declared in the package.json.
       */
      lookup(resolved, packageName, versionSpecifier, resolutions) {
        const dependencyKey = this.getLockFileKey(packageName, versionSpecifier, resolutions);

        const packageInfo = resolved[dependencyKey];
        if (packageInfo) {
          return packageInfo;
        }

        // Fall back to slower iteration-based lookup for combined keys.
        for (const [key, packageInfo] of Object.entries(resolved)) {
          // Resolving ranges: "@babel/runtime@npm:^7.1.2, @babel/runtime@npm:^7.12.13, @babel/runtime@npm:^7.12.5"
          const versionsRange = key.split(',');

          // Resolving yarn link resolutions: "@kaoto/kaoto-ui@portal:/home/rmartinez/repos/kaoto-ui::locator=vscode-kaoto%40workspace%3A."
          const yarnLinkResolution = key.split('::')[0];

          if (
            versionsRange.some((key) => key.trim() === dependencyKey) ||
            yarnLinkResolution === dependencyKey
          ) {
            return packageInfo;
          }
        }
      }

      getLockFileKey(packageName, versionSpecifier, resolutions) {
        // If the package name is in the resolutions field, use the version from there.
        const resolvedVersionSpecifier = resolutions[packageName] ?? versionSpecifier;

        // If the version field contains a URL, don't attempt to use the NPM registry
        return resolvedVersionSpecifier.includes(':')
          ? `${packageName}@${resolvedVersionSpecifier}`
          : `${packageName}@npm:${resolvedVersionSpecifier}`;
      }
    }

    return {
      commands: [ListCommand],
    };
  },
};
