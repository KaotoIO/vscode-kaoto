# Repository Structure Reorganization Plan

## Overview

**Goal:** Reorganize the `vscode-kaoto` repository's source structure to align with VS Code extension best practices and logical domain grouping. No functional changes — only file/folder moves, renames, import/path updates, and related metadata corrections.

**Branch context:** `chore/reworkRepoStructure`

**Constraints:**
- No changes to runtime behavior, business logic, or functionality
- All imports, webpack entry points, tsconfig paths, and `package.json` references must be updated to reflect moves/renames
- All unit tests (`src/test/`) must continue to pass
- All UI tests (renamed from `it-tests/` → `ui-tests/`) must continue to run correctly

**Scope of changes:**
1. Rename two service files from kebab-case to PascalCase
2. Rename one type file from camelCase to PascalCase
3. Split `src/constants.ts` into domain-specific files under `src/constants/`
4. Reorganize `src/helpers/` into focused sub-files under `src/utils/`
5. Restructure `src/views/` into domain-feature subfolders
6. Restructure `src/test/` to mirror the source structure
7. Rename `it-tests/` → `ui-tests/`, restructure its internals, and update every config/script/CI reference
8. Split `it-tests/Util.ts` into focused files under `ui-tests/utils/`

---

## CI and Root Config — Impact Assessment

All CI and root configuration files were fully audited. Sub-Tasks 1–6 require **no** CI or config changes (only source file moves). Sub-Tasks 7–8 touch `it-tests/` and require updates to multiple files.

| File | What it references | Impact |
|------|--------------------|--------|
| `Jenkinsfile` | `yarn test:it:with-prebuilt-vsix` | ⚠️ Update in Sub-Task 7 |
| `.github/workflows/ci.yaml` | `yarn test:unit` only, no `test:it` call | ✅ No change |
| `.github/workflows/main-kaoto.yaml` | `yarn test:unit` only | ✅ No change |
| `.github/workflows/test-self-hosted.yaml` | `yarn test:unit` only | ✅ No change |
| `.github/workflows/_integration-tests.yaml` | `yarn run test:it:with-prebuilt-vsix:minikube` and `yarn run test:it:with-prebuilt-vsix` | ⚠️ Update in Sub-Task 7 |
| `.github/actions/setup-tools/action.yaml` | Tool setup only | ✅ No change |
| `.github/actions/upload-test-artifacts/action.yaml` | `test-resources/` runtime paths | ✅ No change |
| `.github/actions/test-json-reports/action.yaml` | `reports/ui-test-results.json` output | ✅ No change |
| `webpack.config.js` | Entry points `src/extension/extension.ts`, `src/extension/extensionWeb.ts`, `src/webview/KaotoEditorEnvelopeApp.ts` — none move | ✅ No change |
| `tsconfig.json` | `"include": ["src"]` recursive glob | ✅ No change |
| `tsconfig.unit-tests.json` | `"include": ["src/test"]` recursive glob | ✅ No change |
| `tsconfig.it-tests.json` | filename + `rootDir: "it-tests"` + `include: ["it-tests"]` | ⚠️ Rename + update in Sub-Task 7 |
| `eslint.config.mjs` | references `./tsconfig.it-tests.json` by name | ⚠️ Update in Sub-Task 7 |
| `.vscode-test.mjs` | `out/test/**/*.test.js` compiled output glob | ✅ No change |
| `extester.config.json` | `./it-tests/vscode-settings.json` | ⚠️ Update in Sub-Task 7 |
| `.vscodeignore` | `it-tests/**` glob | ⚠️ Update in Sub-Task 7 |
| `.mocharc-json.js` | `./reports/ui-test-results.json` | ✅ No change |
| `package.json` `main`/`browser` | `./dist/extension/*.js` dist paths, source entry files don't move | ✅ No change |
| `package.json` scripts | All `test:it:*`, `build:test:it`, `lint` script bodies | ⚠️ Update in Sub-Task 7 |
| `.vscode/settings.json` | `extesterRunner.testFileGlob` and `extesterRunner.rootFolder` | ⚠️ Update in Sub-Task 7 |
| `AGENTS.md` | References `it-tests/` directory and `test:it` | ⚠️ Update in Sub-Task 7 |
| `CONTRIBUTING.md` | `yarn run test-it` | ⚠️ Update in Sub-Task 7 |

---

## Sub-Tasks

---

### Sub-Task 1 — Rename kebab-case service files to PascalCase

**Status:** `[ ] pending`

**Intent:**
Two service files in `src/services/` use an Angular-style `kebab-case.service.ts` naming convention while every other file in the project uses `PascalCase.ts`. Renaming them brings consistency to the whole codebase.

**Expected Outcomes:**
- `src/services/apicurio-registry.service.ts` → `src/services/ApicurioRegistryService.ts`
- `src/services/openapi-import.service.ts` → `src/services/OpenApiImportService.ts`
- All imports of the old paths updated

**Todo List:**
1. Rename `src/services/apicurio-registry.service.ts` → `src/services/ApicurioRegistryService.ts`
2. Rename `src/services/openapi-import.service.ts` → `src/services/OpenApiImportService.ts`
3. Search for all imports of `apicurio-registry.service` and update to `ApicurioRegistryService`
4. Search for all imports of `openapi-import.service` and update to `OpenApiImportService`
5. Rename `src/test/apicurio-registry.service.test.ts` → `src/test/services/ApicurioRegistryService.test.ts` (also moves into `services/` subfolder — coordinated with Sub-Task 6)
6. Rename `src/test/openapi-import.service.test.ts` → `src/test/services/OpenApiImportService.test.ts`

**Relevant Context:**
- Known importers: `src/commands/ImportOpenApiCommand.ts` (openapi-import.service), `src/extension/extension.ts` (both)
- Test files at: `src/test/apicurio-registry.service.test.ts`, `src/test/openapi-import.service.test.ts`

---

### Sub-Task 2 — Rename `testTreeItemType.ts` to `TestTreeItemType.ts`

**Status:** `[ ] pending`

**Intent:**
`src/types/testTreeItemType.ts` uses a camelCase filename while both sibling files (`IntegrationTreeItemType.ts`, `RouteOperation.ts`) use PascalCase. Rename to match the convention.

**Expected Outcomes:**
- `src/types/testTreeItemType.ts` → `src/types/TestTreeItemType.ts`
- All imports referencing the old path updated

**Todo List:**
1. Rename `src/types/testTreeItemType.ts` → `src/types/TestTreeItemType.ts`
2. Update import in `src/views/providers/TestsProvider.ts`
3. Update import in `src/views/testTreeItems/Test.ts`
4. Search for any other importers of `testTreeItemType` and update them

**Relevant Context:**
- Known importers: `src/views/providers/TestsProvider.ts`, `src/views/testTreeItems/Test.ts`

---

### Sub-Task 3 — Split `src/constants.ts` into domain-specific files under `src/constants/`

**Status:** `[ ] pending`

**Intent:**
`src/constants.ts` is a 209-line monolith with ~94 constants spanning 10 logical groups. Splitting into focused files makes each group discoverable. A barrel `index.ts` re-exports everything so all existing `import … from '../constants'` paths continue to resolve automatically via TypeScript's directory→`index.ts` resolution — zero consumer changes needed.

**Expected Outcomes:**
- `src/constants.ts` deleted
- `src/constants/` created with:
  - `defaults.ts` — `DEFAULT_CAMEL_VERSION_FALLBACK`, `MIN_CAMEL_VERSION_FOR_TEST`, `KAOTO_EDITOR_VIEW_TYPE`
  - `patterns.ts` — `KAOTO_FILE_PATH_GLOB`, `KAOTO_EXCLUDE_PATTERN`, `DEFAULT_KAOTO_OPENAPI_FILES_REGEXP`
  - `settings.ts` — all general `KAOTO_*_SETTING_ID` constants
  - `executor-settings.ts` — all `KAOTO_EXECUTOR_*` setting ID constants
  - `commands.ts` — all `KAOTO_*_COMMAND_ID` constants (~51)
  - `views.ts` — all view/panel container ID constants
  - `context-keys.ts` — VS Code context key constants
  - `global-state-keys.ts` — global state key constants
  - `trusted-urls.ts` — trusted source URL constants
  - `index.ts` — barrel re-exporting all of the above

**Todo List:**
1. Create `src/constants/` directory
2. Create each of the 9 domain files listed above, moving the matching constants
3. Create `src/constants/index.ts` with `export * from './defaults'` etc. for each file
4. Delete `src/constants.ts`
5. Verify TypeScript resolves all `'../constants'` imports correctly (no consumer changes needed)

**Relevant Context:**
- `"moduleResolution": "Bundler"` resolves `'../constants'` → `'../constants/index.ts'` automatically
- Heavy consumers: `src/extension/extension.ts`, all command files, all provider files

---

### Sub-Task 4 — Reorganize `src/helpers/` into focused files under `src/utils/`

**Status:** `[ ] pending`

**Intent:**
`src/helpers/` is a flat collection of 12 unrelated utility files including a catch-all `helpers.ts` with 14+ diverse exports. Rename the directory to `src/utils/` and split `helpers.ts` into four focused files by concern. All other files move as-is.

**Expected Outcomes:**
- `src/helpers/helpers.ts` content split into four focused files:
  - `src/utils/vscode.ts` — `safeGlobalStateGet`, `safeGlobalStateUpdate`, `isRedHatBuild`
  - `src/utils/process.ts` — `verifyJBangExists`, `verifyJavaExists`, `verifyCamelPluginsAreInstalled`, `verifyJBangTrustedSources`, `runJBangCommandWithStatusBar`, `runCommandWithStatusBar`, `CommandOutput` interface
  - `src/utils/path.ts` — `arePathsEqual`, `findFolderOfPomXml`, `resolvePaths`
  - `src/utils/version.ts` — `normalizeVersionForSemver`
- All other `src/helpers/` files move unchanged to `src/utils/`:
  `ApplicationPropertiesFinder.ts`, `ArgumentConflictDetector.ts`, `ClasspathRootFinder.ts`, `DockerErrorDetector.ts`, `KameletFileReader.ts`, `MavenRuntimeDetector.ts`, `modals.ts`, `PortManager.ts`, `StepsOnSaveManager.ts`, `SuggestionRegistry.ts`, `TestFolderResolver.ts`
- `src/helpers/` directory deleted
- All `helpers/<FileName>` imports updated to `utils/<FileName>`
- All `helpers/helpers` imports updated to the correct new split-file path

**Todo List:**
1. Create `src/utils/` directory
2. Create `src/utils/vscode.ts` — extract VS Code state helpers from `helpers.ts`
3. Create `src/utils/process.ts` — extract CLI/process helpers from `helpers.ts`
4. Create `src/utils/path.ts` — extract path helpers from `helpers.ts`
5. Create `src/utils/version.ts` — extract version helper from `helpers.ts`
6. Move each remaining `src/helpers/` file unchanged to `src/utils/` (11 files)
7. Delete `src/helpers/helpers.ts`
8. Delete `src/helpers/` directory
9. Update all `helpers/helpers` imports to the appropriate new split-file path
10. Update all `helpers/<FileName>` imports to `utils/<FileName>`
11. Rename `src/test/helpers/` → `src/test/utils/` and update internal imports (coordinated with Sub-Task 6)

**Relevant Context:**
- Heavy consumers of `helpers.ts`: `src/extension/extension.ts`, `src/commands/*`, `src/executors/*`
- Test folder to rename: `src/test/helpers/` (3 test files + `TestSetup.ts`)

---

### Sub-Task 5 — Restructure `src/views/` into domain-feature subfolders

**Status:** `[ ] pending`

**Intent:**
The current `src/views/` layout splits tree items and providers across parallel sub-folders with no domain grouping. The import graph confirms every domain is fully isolated. The target structure groups each domain's provider and tree items together. Shared base classes move to `src/views/shared/`.

**Expected Outcomes:**
```
src/views/
├── integrations/
│   ├── IntegrationsProvider.ts         (was providers/IntegrationsProvider.ts)
│   ├── Integration.ts                  (was integrationTreeItems/Integration.ts)
│   ├── File.ts                         (was integrationTreeItems/File.ts)
│   ├── Folder.ts                       (was integrationTreeItems/Folder.ts)
│   └── Route.ts                        (was integrationTreeItems/Route.ts)
├── deployments/
│   ├── DeploymentsProvider.ts          (was providers/DeploymentsProvider.ts)
│   ├── ChildItem.ts                    (was deploymentTreeItems/ChildItem.ts)
│   ├── ParentItem.ts                   (was deploymentTreeItems/ParentItem.ts)
│   ├── RootItem.ts                     (was deploymentTreeItems/RootItem.ts)
│   └── Route.ts                        (was deploymentTreeItems/Route.ts)
├── tests/
│   ├── TestsProvider.ts                (was providers/TestsProvider.ts)
│   ├── Test.ts                         (was testTreeItems/Test.ts)
│   └── TestFolder.ts                   (was testTreeItems/TestFolder.ts)
├── openapi/
│   ├── OpenApiProvider.ts              (was providers/OpenApiProvider.ts)
│   ├── OpenApiFile.ts                  (was openApiTreeItems/OpenApiFile.ts)
│   └── OpenApiFolder.ts               (was openApiTreeItems/OpenApiFolder.ts)
├── infrastructure/
│   ├── InfrastructureProvider.ts       (was providers/InfrastructureProvider.ts)
│   ├── InfrastructureRefreshManager.ts (was providers/InfrastructureRefreshManager.ts)
│   ├── InfrastructureServiceManager.ts (was providers/InfrastructureServiceManager.ts)
│   └── InfrastructureItem.ts          (was infrastructureTreeItems/InfrastructureItem.ts)
├── help/
│   └── HelpFeedbackProvider.ts        (was providers/HelpFeedbackProvider.ts)
└── shared/
    ├── AbstractFolderTreeProvider.ts   (was providers/AbstractFolderTreeProvider.ts)
    └── AbstractFolder.ts              (was treeItems/AbstractFolder.ts)
```

**Todo List:**
1. Create all new domain directories: `integrations/`, `deployments/`, `tests/`, `openapi/`, `infrastructure/`, `help/`, `shared/`
2. Move files from each `*TreeItems/` folder and matching provider into the corresponding domain folder
3. Move `AbstractFolderTreeProvider.ts` and `AbstractFolder.ts` → `src/views/shared/`
4. Delete emptied directories: `providers/`, `integrationTreeItems/`, `deploymentTreeItems/`, `testTreeItems/`, `openApiTreeItems/`, `infrastructureTreeItems/`, `treeItems/`
5. Update all relative import paths inside every moved file (depth changes)
6. Update imports in `src/extension/extension.ts` and `src/extension/extensionWeb.ts`
7. Update import paths in `src/test/views/` test files

**Relevant Context:**
- Import graph is fully domain-isolated — no cross-domain tree item dependencies
- `AbstractFolderTreeProvider` is shared by `TestsProvider` and `OpenApiProvider` (extends)
- `AbstractFolder` is shared by `TestFolder` and `OpenApiFolder` (extends) — both move to different domain folders, import path becomes `../shared/AbstractFolder`
- `IFolderTreeItem` interface defined inside `AbstractFolderTreeProvider` and used by `AbstractFolder`

---

### Sub-Task 6 — Restructure `src/test/` to mirror the source structure

**Status:** `[ ] pending`

**Intent:**
Several unit test files sit at the root of `src/test/` instead of in a subfolder matching their source module. The `helpers/` test subfolder is renamed to `utils/` to mirror Sub-Task 4. View test files are reorganized into domain subfolders to mirror Sub-Task 5.

**Expected Outcomes:**
```
src/test/
├── commands/                                             (new)
│   └── ValidateNewProjectGAV.test.ts                    (was root)
├── executors/                                            (unchanged)
├── extension/
│   ├── ExtensionContextHandler.test.ts                  (unchanged)
│   ├── KaotoOutputChannel.test.ts                       (unchanged)
│   ├── activation.test.ts                               (was root)
│   └── VSCodeKaotoEditorChannelApiSettings.test.ts      (was root, renamed)
├── services/
│   ├── CamelLauncherDownloader.test.ts                  (unchanged)
│   ├── KaotoCatalogService.test.ts                      (unchanged)
│   ├── ApicurioRegistryService.test.ts                  (was root, renamed per Sub-Task 1)
│   └── OpenApiImportService.test.ts                     (was root, renamed per Sub-Task 1)
├── utils/                                               (was helpers/)
│   ├── ArgumentConflictDetector.test.ts
│   ├── DockerErrorDetector.test.ts
│   ├── KameletFileReader.test.ts
│   ├── ClasspathRootFinder.test.ts                      (was root)
│   └── TestSetup.ts
├── views/
│   ├── deployments/                                     (new subfolder)
│   │   └── DeploymentsProvider.test.ts
│   └── infrastructure/                                  (new subfolder)
│       ├── InfrastructureItem.test.ts
│       ├── InfrastructureProvider.test.ts
│       ├── InfrastructureRefreshManager.test.ts
│       └── InfrastructureServiceManager.test.ts
├── webview/                                              (unchanged)
├── stubs/                                                (unchanged)
└── global.d.ts                                          (unchanged)
```

**Todo List:**
1. Create `src/test/commands/` directory
2. Move `src/test/ValidateNewProjectGAV.test.ts` → `src/test/commands/`, update its import path
3. Move `src/test/activation.test.ts` → `src/test/extension/`, update its import path
4. Move and rename `src/test/VSCodeKaotoEditorChannelApi.test.ts` → `src/test/extension/VSCodeKaotoEditorChannelApiSettings.test.ts`, update its import paths
5. Rename `src/test/helpers/` → `src/test/utils/`, update imports inside all files within it
6. Move `src/test/ClasspathRootFinder.test.ts` → `src/test/utils/`, update its import path
7. Create `src/test/views/deployments/` and `src/test/views/infrastructure/` directories
8. Move `src/test/views/DeploymentsProvider.test.ts` → `src/test/views/deployments/`
9. Move the four infrastructure test files → `src/test/views/infrastructure/`
10. Update all import paths in every moved test file (relative depth changes)

**Relevant Context:**
- `src/test/VSCodeKaotoEditorChannelApi.test.ts` (root-level) tests settings retrieval — distinct from `src/test/webview/VSCodeKaotoEditorChannelApi.test.ts` which is a stub
- `tsconfig.unit-tests.json` `"include": ["src/test"]` is recursive — picks up all moved files automatically
- `.vscode-test.mjs` `out/test/**/*.test.js` glob — picks up all compiled moved files automatically

---

### Sub-Task 7 — Rename `it-tests/` → `ui-tests/`, restructure internals, update all references

**Status:** `[ ] pending`

**Intent:**
The `it-tests/` directory name is misleading — the `Jenkinsfile` already calls this stage `'UI Tests'`. Renaming to `ui-tests/` aligns the directory with its purpose. The six root-level loose test files (excluding `Z_IntegrationsViewNewProject.test.ts`, `Util.ts`, and config files) move into a new `editor/` subfolder so the root contains only config, shared utilities, and top-level ordering anchors. Every config, script, tsconfig, CI file, and documentation reference is updated.

Note: `Util.ts` stays at `ui-tests/` root for this sub-task — it is split in Sub-Task 8.

**Expected Outcomes — Directory structure:**
```
ui-tests/                                    (was it-tests/)
├── pageObjects/                             (unchanged)
├── editor/                                  (new — was root-level loose tests)
│   ├── BasicFlow.test.ts
│   ├── ContextualMenuOpen.test.ts
│   ├── MavenDependencyUpdate.test.ts
│   ├── OpenTextualEditorCommand.test.ts
│   ├── PropertyPanelLoading.test.ts
│   └── SwitchBetweenTabs.test.ts
├── settings/                                (unchanged)
├── views/                                   (unchanged)
├── Z_IntegrationsViewNewProject.test.ts     (kept at root — Z_ prefix is intentional)
├── Util.ts                                  (kept at root until Sub-Task 8)
├── vscode-settings.json                     (unchanged)
└── vscode-settings-minikube.json           (unchanged)
```

**Expected Outcomes — Config and script changes:**

| File | Change |
|------|--------|
| `package.json` `lint` | `eslint src it-tests` → `eslint src ui-tests` |
| `package.json` `build:test:it` | rename key to `build:test:ui`, update `tsconfig.it-tests.json` → `tsconfig.ui-tests.json` |
| `package.json` `test:it` | rename key to `test:ui`, update internal `build:test:it` call → `build:test:ui` |
| `package.json` `setup:test:it:with-prebuilt-vsix` | rename key to `setup:test:ui:with-prebuilt-vsix`, update internal `build:test:it` call → `build:test:ui` |
| `package.json` `test:it:with-prebuilt-vsix` | rename key to `test:ui:with-prebuilt-vsix`, update `./it-tests/vscode-settings.json` → `./ui-tests/vscode-settings.json`, update `setup:test:it:` call → `setup:test:ui:` |
| `package.json` `test:it:with-prebuilt-vsix:minikube` | rename key to `test:ui:with-prebuilt-vsix:minikube`, update path and call |
| `package.json` `test:it:clean` | rename key to `test:ui:clean` |
| `tsconfig.it-tests.json` | rename file to `tsconfig.ui-tests.json`, update `"rootDir": "it-tests"` → `"ui-tests"` and `"include": ["it-tests"]` → `["ui-tests"]` |
| `eslint.config.mjs` | `'./tsconfig.it-tests.json'` → `'./tsconfig.ui-tests.json'` |
| `extester.config.json` | `./it-tests/vscode-settings.json` → `./ui-tests/vscode-settings.json` |
| `.vscodeignore` | `it-tests/**` → `ui-tests/**` |
| `.vscode/settings.json` | `extesterRunner.testFileGlob`: `**/it-tests/**` → `**/ui-tests/**`; `extesterRunner.rootFolder`: `it-tests` → `ui-tests` |
| `Jenkinsfile` | `yarn test:it:with-prebuilt-vsix` → `yarn test:ui:with-prebuilt-vsix` |
| `.github/workflows/_integration-tests.yaml` | `test:it:with-prebuilt-vsix:minikube` → `test:ui:with-prebuilt-vsix:minikube`; `test:it:with-prebuilt-vsix` → `test:ui:with-prebuilt-vsix` |
| `AGENTS.md` | `it-tests/` → `ui-tests/`; `test:it*` → `test:ui*`; `build:test:it` → `build:test:ui` |
| `CONTRIBUTING.md` | `yarn run test-it` → `yarn run test:ui` |

**Todo List:**
1. Rename the `it-tests/` directory → `ui-tests/`
2. Create `ui-tests/editor/` subdirectory
3. Move the six root-level loose test files into `ui-tests/editor/`: `BasicFlow.test.ts`, `ContextualMenuOpen.test.ts`, `MavenDependencyUpdate.test.ts`, `OpenTextualEditorCommand.test.ts`, `PropertyPanelLoading.test.ts`, `SwitchBetweenTabs.test.ts`
4. Update imports inside those six moved files: `from './Util'` → `from '../Util'`, `from './pageObjects/...'` → `from '../pageObjects/...'`
5. Rename `tsconfig.it-tests.json` → `tsconfig.ui-tests.json`; update `rootDir` and `include` values from `it-tests` → `ui-tests`
6. Update `eslint.config.mjs`: `'./tsconfig.it-tests.json'` → `'./tsconfig.ui-tests.json'`
7. Update `extester.config.json`: `./it-tests/vscode-settings.json` → `./ui-tests/vscode-settings.json`
8. Update `.vscodeignore`: `it-tests/**` → `ui-tests/**`
9. Update `.vscode/settings.json`: both `extesterRunner` values
10. Update `package.json`: all 7 script renames/body updates as listed above
11. Update `Jenkinsfile` line 39: `test:it:with-prebuilt-vsix` → `test:ui:with-prebuilt-vsix`
12. Update `.github/workflows/_integration-tests.yaml`: both `test:it:*` script calls
13. Update `AGENTS.md`: all `it-tests/` and `test:it*` references
14. Update `CONTRIBUTING.md`: `yarn run test-it` → `yarn run test:ui`

**Relevant Context:**
- `Z_IntegrationsViewNewProject.test.ts` stays at `ui-tests/` root — the `Z_` prefix is intentional for test ordering
- `Util.ts` stays at `ui-tests/` root until Sub-Task 8 splits it
- `tsconfig.ui-tests.json` `outDir` stays `"out"` — the `extester.config.json` `testFiles: ["out/**/*.test.js"]` glob is unaffected
- After step 4, verify that `views/*.test.ts` and `settings/*.test.ts` still import from `'../Util'` — their depth is unchanged

---

### Sub-Task 8 — Split `ui-tests/Util.ts` into focused files under `ui-tests/utils/`

**Status:** `[ ] pending`

**Intent:**
`Util.ts` is a 687-line catch-all with functions spanning five unrelated concerns. Splitting it into focused files under `ui-tests/utils/` makes each area easy to find and maintain. All 20 import sites across the test suite are updated to import from the specific new file.

**Expected Outcomes:**
```
ui-tests/
└── utils/                              (new directory — replaces Util.ts)
    ├── constants.ts                    — CATALOG_VERSION_ID
    ├── terminal.ts                     — waitUntilTerminalHasText, killTerminal, activateTerminalView
    ├── editor.ts                       — openAndSwitchToKaotoFrame, switchToKaotoFrame,
    │                                     checkEmptyCanvasLoaded, checkTopologyLoaded,
    │                                     closeEditor, dismissHoverOverlay, clickWhenClickable,
    │                                     workaroundToRedrawContextualMenu
    │                                     (private: isInsideKaotoWebview, ensureKaotoEditorIsActive)
    ├── extension.ts                    — openResourcesAndWaitForActivation, waitForExtensionActivation
    │                                     (private: KaotoStatusBarState, getKaotoStatusBarState,
    │                                      openExtensionPage, extensionIsActivated)
    ├── settings.ts                     — storageFolder, resetUserSettings,
    │                                     setUserSettingsDirectly, readUserSetting
    ├── tree-view.ts                    — getTreeItem, expandFolderItemsInTreeStructuredView,
    │                                     collapseItemsInsideTreeStructuredView, getViewActionButton,
    │                                     getTreeItemActionButton, collapseViews, expandViews,
    │                                     getKaotoViewControl
    │                                     (private: reopenKaotoView)
    └── workbench.ts                    — dismissBlockingModal, handleInputPathSelection
```

`ui-tests/Util.ts` is deleted after all imports are migrated.

**Todo List:**
1. Create `ui-tests/utils/` directory
2. Create `ui-tests/utils/constants.ts` with `CATALOG_VERSION_ID`
3. Create `ui-tests/utils/terminal.ts` with `waitUntilTerminalHasText`, `killTerminal`, `activateTerminalView`
4. Create `ui-tests/utils/editor.ts` with `openAndSwitchToKaotoFrame`, `switchToKaotoFrame`, `isInsideKaotoWebview` (private), `ensureKaotoEditorIsActive` (private), `checkEmptyCanvasLoaded`, `checkTopologyLoaded`, `closeEditor`, `dismissHoverOverlay`, `clickWhenClickable`, `workaroundToRedrawContextualMenu`
5. Create `ui-tests/utils/extension.ts` with `openResourcesAndWaitForActivation`, `waitForExtensionActivation`, `KaotoStatusBarState` type, `getKaotoStatusBarState` (private), `openExtensionPage` (private), `extensionIsActivated` (private)
6. Create `ui-tests/utils/settings.ts` with `storageFolder`, `resetUserSettings`, `setUserSettingsDirectly`, `readUserSetting`
7. Create `ui-tests/utils/tree-view.ts` with `getTreeItem`, `expandFolderItemsInTreeStructuredView`, `collapseItemsInsideTreeStructuredView`, `getViewActionButton`, `getTreeItemActionButton`, `reopenKaotoView` (private), `collapseViews`, `expandViews`, `getKaotoViewControl`
8. Create `ui-tests/utils/workbench.ts` with `dismissBlockingModal`, `handleInputPathSelection`
9. Delete `ui-tests/Util.ts`
10. Update all 20 import sites — replace `from './Util'` or `from '../Util'` with imports from the specific new file(s) for each function used

**Import site map** (each site needs to import from the file(s) that contain the specific symbols it uses):

| File | Symbols imported | New import source(s) |
|------|-----------------|---------------------|
| `ui-tests/editor/BasicFlow.test.ts` | `checkEmptyCanvasLoaded`, `checkTopologyLoaded`, `openAndSwitchToKaotoFrame`, `storageFolder` + others | `../utils/editor`, `../utils/settings` |
| `ui-tests/editor/ContextualMenuOpen.test.ts` | `checkEmptyCanvasLoaded`, `openResourcesAndWaitForActivation`, `switchToKaotoFrame` | `../utils/editor`, `../utils/extension` |
| `ui-tests/editor/MavenDependencyUpdate.test.ts` | various | map per actual imports |
| `ui-tests/editor/OpenTextualEditorCommand.test.ts` | various | map per actual imports |
| `ui-tests/editor/PropertyPanelLoading.test.ts` | `clickWhenClickable`, `dismissHoverOverlay`, `openAndSwitchToKaotoFrame` | `../utils/editor` |
| `ui-tests/editor/SwitchBetweenTabs.test.ts` | `openAndSwitchToKaotoFrame` | `../utils/editor` |
| `ui-tests/views/*.test.ts` (12 files) | various combinations | `../utils/<file>` |
| `ui-tests/settings/CatalogURLSettings.test.ts` | `checkTopologyLoaded`, `closeEditor`, `dismissBlockingModal`, `openAndSwitchToKaotoFrame`, `resetUserSettings`, `switchToKaotoFrame` | `../utils/editor`, `../utils/workbench`, `../utils/settings` |
| `ui-tests/settings/NodeLabelSettings.test.ts` | `checkTopologyLoaded`, `closeEditor`, `dismissBlockingModal`, `openAndSwitchToKaotoFrame`, `resetUserSettings` | `../utils/editor`, `../utils/workbench`, `../utils/settings` |
| `ui-tests/Z_IntegrationsViewNewProject.test.ts` | various | `./utils/<file>` |

> Note: The exact per-symbol breakdown for `views/*.test.ts` and other multi-import files must be resolved by reading the import statements in each file during implementation. The implementation agent should grep each file's import from `Util` and route each named export to its new home.

**Relevant Context:**
- All private functions (`isInsideKaotoWebview`, `ensureKaotoEditorIsActive`, `reopenKaotoView`, `getKaotoStatusBarState`, `openExtensionPage`, `extensionIsActivated`) are internal to their respective new file — they are not exported and not imported anywhere outside `Util.ts`; only the public exports are imported by test files
- Cross-file dependency within `utils/`: `editor.ts` calls `dismissBlockingModal` (from `workbench.ts`) in `closeEditor`; `extension.ts` and `tree-view.ts` have no internal cross-dependencies
- The `tsconfig.ui-tests.json` `"include": ["ui-tests"]` recursive glob picks up the new `utils/` directory automatically

---

## Ordering

```
Sub-Task 1  ──┐
Sub-Task 2  ──┤
Sub-Task 3  ──┤── all independent, do first
Sub-Task 4  ──┤
              │
Sub-Task 5  ──┤── must precede Sub-Task 6 (test paths reference new view layout)
              │
Sub-Task 6  ──┘── depends on Sub-Tasks 1, 4, 5
              
Sub-Task 7  ──── independent of Sub-Tasks 1–6, do after 1–6 to keep blast radius small

Sub-Task 8  ──── must follow Sub-Task 7 (Util.ts must be in ui-tests/ first)
```

## Post-Completion Verification

After all sub-tasks are complete, run:
```bash
yarn run lint
yarn run test:unit
yarn run build:dev
yarn run build:test:ui
```

All must pass with zero new errors or warnings.
