# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension for **Kaoto**, a visual low-code editor for Apache Camel integrations. The extension integrates the Kaoto UI into VS Code and provides tooling for creating, editing, and managing Camel routes, pipes, and kamelets.

## Development Commands

### Build and Development

- `yarn run compile` - Compile TypeScript and webpack the extension
- `yarn run watch` - Watch mode for development (with dev webpack config)
- `yarn run build:prod` - Production build (clean, compile, lint)
- `yarn run build:dev` - Development build (clean, watch, lint)

### Linting and Code Quality

- `yarn run lint` - Lint TypeScript files in `src` and `it-tests`
- ESLint configuration in `eslint.config.mjs` with TypeScript and Prettier integration

### Testing

- `yarn run test:unit` - Run unit tests using VS Code test framework
- `yarn run test:it` - Run integration tests using extension tester
- `yarn run build:test:unit` - Build unit tests
- `yarn run build:test:it` - Build integration tests
- Unit tests located in `src/test/`
- Integration tests in `it-tests/`

#### How to run Integration tests

1. yarn build:dev
2. yarn vsce package --no-dependencies --yarn
3. yarn run test:it:with-prebuilt-vsix
   3.1 For headless: `xvfb-run -a yarn run test:it:with-prebuilt-vsix`

### Web Mode Testing

- `yarn run run:webmode` - Run extension in browser environment for testing

## Architecture

### Extension Structure

- **Entry Points:**
  - `src/extension/extension.ts` - Main extension activation for desktop VS Code
  - `src/extension/extensionWeb.ts` - Web extension entry point
  - `src/webview/KaotoEditorEnvelopeApp.ts` - Webview editor application

- **Key Directories:**
  - `src/commands/` - VS Code commands for creating Camel files
  - `src/views/` - Tree view providers for integrations and deployments
  - `src/tasks/` - Camel JBang task implementations for CLI operations
  - `src/helpers/` - Utility functions and managers
  - `src/webview/` - Webview integration with Kaoto editor

### Webpack Configuration

- Multi-target build: Web worker + Web UI
- Builds to `dist/` directory
- Uses TypeScript with webpack for bundling
- SASS/CSS support for webview UI components

### Dependencies

- **Core Editor:** `@kaoto/kaoto` (v2.7.1) - The main Kaoto editor library, [repository](https://github.com/KaotoIO/kaoto)
- **VS Code Integration:** `@kie-tools-core/*` packages for editor envelope and backend, [repository](https://github.com/apache/incubator-kie-tools)
- **UI Framework:** PatternFly React components
- **Camel Support:** Uses Camel JBang CLI for operations

## File Types Supported

- `*.camel.yaml`, `*.camel.yml` - Camel route files
- `*.camel.xml` - Camel XML route files
- `*.kamelet.yaml`, `*.kamelet.yml` - Kamelet files
- `*.pipe.yaml`, `*.pipe.yml`, `*-pipe.yaml`, `*-pipe.yml` - Pipe files

## VS Code Integration

- Custom editor for supported file types
- Tree views for integrations and deployments
- Commands for creating new Camel files
- Integration with Camel JBang CLI for running and deploying

## TypeScript Configuration

- Target ES6 with React JSX support
- Strict null checks and no implicit any
- Module resolution set to "Bundler"
- Source maps enabled for debugging

## Testing Framework

- Unit tests use VS Code test framework with Mocha
- Integration tests use `vscode-extension-tester`
- Chai assertions with chai-friendly ESLint rules
- Test configuration in `.vscode-test.mjs`
