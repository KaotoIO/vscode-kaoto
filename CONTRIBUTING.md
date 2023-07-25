Everyone is welcome to contribute to Kaoto.

We have a Kanban board with good first issues in https://github.com/orgs/KaotoIO/projects/4

There are many ways to contribute to Kaoto:

## Issues

### Submit a new issue

If you have a bug or a suggestion for a new feature, you can create new issues.
Always **use one of the templates available** and answer as many of the questions as you can.

If you are **submitting a bug**, provide a simple step by step explanation of how to reproduce it and what is the expected outcome.

If you are **submitting a feature**, be ready to follow up and contribute with its development. Features that are proposed but don't have
funds or developers ready to implement it may be closed due to not enough interest raised. If you can't fund or implement it yourself and
you want the feature implemented, you must look for a way to find resources to implement it.

### Clarifying bugs

You can also contribute by looking for open bugs and test corner cases to add more information to help developers.

### Implementing bug fixes or features

Feel free to work on any of the open issues. Add a comment to it saying that you want to work on it and deliver regular updates on the
status of the development.

If you can no longer work on an issue, please, let us know as soon as possible so someone else can work on it.

See pull request section.

## Pull Requests

If you are reviewing pull requests, please use the [conventional comments](https://conventionalcomments.org/) standard to do so.
Comments that don't follow this standard may be ignored.

There are a few things to consider when sending a pull request merge:

 * Small commits. We prefer small commits because they are easier to review
 * All commits must pass tests: Each commit should have consistency on its own and don't break any functionality
 * All jobs/checks must be green: This includes test coverage, code smells, security issues,...
 * Be descriptive on the PR text about what the changes are. Better to have duplicated explanation than no explanation at all. Provide examples.
 * Add screenshots and videos of what your PR is doing. Especially if you are adding a new feature.
 * High test coverage: Your code must be covered by unit and e2e tests. If for some reason your PR can't or shouldn't, be very clear why. The tests must be included in the same PR.

### How your commits messages should look like

**All your commits should follow the [conventional commits standard](https://www.conventionalcommits.org/).**

The Conventional Commits specification is a lightweight convention on top of commit messages.
It provides an easy set of rules for creating an explicit commit history; which makes it easier to write automated tools on top of.
This convention dovetails with SemVer, by describing the features, fixes, and breaking changes made in commit messages.

The commit message should be structured as follows:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

The commit contains the following structural elements, to communicate intent to the consumers of your library:

* fix: a commit of the type fix patches a bug in your codebase (this correlates with PATCH in Semantic Versioning).
* feat: a commit of the type feat introduces a new feature to the codebase (this correlates with MINOR in Semantic Versioning).
* BREAKING CHANGE: a commit that has a footer BREAKING CHANGE:, or appends a ! after the type/scope, introduces a breaking API change
(correlating with MAJOR in Semantic Versioning). A BREAKING CHANGE can be part of commits of any type.
* types other than fix: and feat: are allowed, like build:, chore:, ci:, docs:, style:, refactor:, perf:, test:, and others.
* footers other than BREAKING CHANGE: `description` may be provided and follow a convention similar to git trailer format.

Additional types are not mandated by the Conventional Commits specification, and have no implicit effect in Semantic Versioning
(unless they include a BREAKING CHANGE). A scope may be provided to a commit’s type, to provide additional contextual information and
is contained within parenthesis, e.g., `feat(parser): add ability to parse arrays`.

## Development environment

### How to build locally

* `yarn`
* `yarn build:dev`
* `yarn build:prod`
* `yarn vsce package --no-dependencies --yarn` to build the vsix binary

### How to launch VS Code extension during development

#### Desktop

Inside VS Code, launch the `Run and Debug configuration` called `Run Extension`.

#### Web

This is available for future plan. This is not supported.

You need to launch the script task `yarn run run:webmode`

### How to manually test latest Kaoto UI

If you'd like to test latest Kaoto UI and not rely on a released version, follow these steps:

* In `kaoto-ui` local clone folder:
  * `yarn`
  * `yarn workspace @kaoto/kaoto-ui run build:lib`
* Open VS Code on `vscode-kaoto` local clone folder
* `yarn`
* `yarn link` _\<kaoto-ui local clone folder uri>/packages/kaoto-ui_
  * i.e. `yarn link ~/repositories/kaoto-ui/packages/kaoto-ui`
* `yarn build:dev`
* In `Run and debug` perspective, call the `Run Extension` launch configuration
* In the new VS Code opened (which has `[Extension Development host]` in window title),
  * Open a folder (use the one you want)
  * Create a file named with the following pattern `*.kaoto.yaml`
  * Open the file

To return to the default Kaoto UI version, just write on `vscode-kaoto` local clone folder:
* `yarn unlink` _\<kaoto-ui local clone folder uri>/packages/kaoto-ui_
  * i.e. `yarn unlink ~/repositories/kaoto-ui/packages/kaoto-ui`

More information about [linking](https://yarnpkg.com/cli/link) and [unlinking](https://yarnpkg.com/cli/unlink) local packages with [yarn](https://yarnpkg.com/)

### How to debug Kaoto UI embedded in VS Code

The command `Developer: Toggle Developer Tools` gives access to classic developer tools for web applications. See [official documentation](https://code.visualstudio.com/api/extension-guides/webview#inspecting-and-debugging-webviews) for more details.

### How to manually test latest Kaoto Backend

If you'd like to test latest Kaoto backend and not rely on a released version, follow these steps:

* In `src/extension.ts`, comment call to `await warmupKaotoBackend()` in `activate` method.
* Start Kaoto backend the way you prefer on `localhost:8097`. For instance [in dev mode](https://github.com/KaotoIO/kaoto-backend#running-the-dev-mode), from kaoto-backend repository, call `mvn quarkus:dev -pl api -Dquarkus.http.port=8097`.
** Take care that the Kaoto backend started correctly. In case you have VS Code Kaoto installed, you might have port conflict issues, which will lead to use an old version of the backend.
** Wait that the Kaoto backend ends to warmup all catalogs (usually takes less than 5 seconds)
* In `Run and debug` perspective, call the `Run Extension` launch configuration

### How to launch automated tests

`yarn run test-it`

It is launching UI tests. Beware that it can take several minutes to start. Stay tuned for improvements to come later.

## How to provide a new release version on VS Code Marketplace

* Check that the version in package.json has not been published yet
    * If already published:
        * Update version in `package.json`
        * Push changes in a Pull Request
        * Wait for Pull Request to be merged
* Check build is working fine on [GitHub Actions](https://github.com/KaotoIO/vscode-kaoto/actions) and [Jenkins CI](https://studio-jenkins-csb-codeready.apps.ocp-c1.prod.psi.redhat.com/job/Fuse/job/VSCode/job/vscode-kaoto-release/)
* Check that someone listed as _submitter_ in Jenkinsfile is available
* Create a tag
* Push the tag to vscode-kaoto repository
* Start build on [Jenkins CI](https://studio-jenkins-csb-codeready.apps.ocp-c1.prod.psi.redhat.com/job/Fuse/job/VSCode/job/vscode-kaoto-release/) with _publishToMarketPlace_ and _publishToOVSX_ parameters checked
* When the build hits the _Publish to Marketplace_ step, it will wait for an approval
* It is possible to check that the produced vsix is valid by using the one pushed in [Jboss download area](https://download.jboss.org/jbosstools/vscode/snapshots/vscode-kaoto/)
* For someone in _submitter_ list:
  * Ensure you are logged in
  * Go to the console log of the build and click `Proceed`
* Wait few minutes and check that it has been published on [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-kaoto) and [Open VSX Marketplace](https://open-vsx.org/extension/redhat/vscode-kaoto)
* Keep build forever on Jenkins CI for later reference and edit build information to indicate the version
* Prepare next iteration:
    * Update version in `package.json`
    * Push changes in a Pull Request
    * Follow Pull Request until it is approved/merged
