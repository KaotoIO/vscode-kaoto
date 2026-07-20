---
name: WI-1 Bob IDE Modes Tree View
overview: "Implement the Bob IDE Modes tree view in the Kaoto sidebar: constants, BobModeItem, BobModesProvider, package.json wiring, BobModesRegistrar, and extension.ts call."
todos:
  - id: st-1-constants
    content: "ST-1: Add VIEW_BOB_MODES and COMMAND_BOB_MODES_* constants to src/constants.ts"
    status: done
  - id: st-2-tree-item
    content: "ST-2: Create src/extension/bob/BobModeItem.ts"
    status: done
  - id: st-3-provider
    content: "ST-3: Create src/extension/bob/BobModesProvider.ts"
    status: done
  - id: st-4-package-json
    content: "ST-4: Wire package.json — view, commands, menus, viewsWelcome"
    status: done
  - id: st-5-registration
    content: "ST-5: Create src/extension/bob/BobModesRegistrar.ts and call registerBobModes() from extension.ts"
    status: done
isProject: false
---

# Implementation Plan: WI-1 Bob IDE Modes Tree View

## Top-Level Overview

Add a "Bob IDE Modes" tree view to the Kaoto sidebar. The view lists every mode entry from `.bob/custom_modes.yaml` in a flat list. Each item shows the mode `name` as label and `slug` as description. Clicking an item opens the file in the Kaoto editor. An inline ▶ button triggers the "Try It…" stub. A "Show Source" right-click action opens the text editor at the `- slug:` line. When no modes file exists a welcome panel guides the user to create one via `kaoto.bobModes.create`.

The implementation follows existing patterns exactly:
- **Flat provider structure** → `HelpFeedbackProvider` pattern (`TreeDataProvider` directly, no `AbstractFolderTreeProvider`)
- **EventEmitter + FileSystemWatcher** → `IntegrationsProvider` pattern
- **Registration isolated** → new `src/extension/bob/BobModesRegistrar.ts` module; `ExtensionContextHandler.ts` stays untouched
- **YAML parsing** → `import { parse } from 'yaml'` (already a project dependency)

Dominik's Bob chat integration (`sendMessageWithHiddenPrompt`) is **not** implemented here. The "Try It…" handler uses a stub that logs to the output channel and shows an info message. Dominik replaces the stub body later.

### Separation principle

All Bob-specific code lives under `src/extension/bob/`. The only changes to existing files are:
- `src/constants.ts` — 5 new constant lines (additive only)
- `package.json` — additive entries in views/commands/menus/viewsWelcome
- `src/extension/extension.ts` — one new import + one new call in the "register all views" block
- `ExtensionContextHandler.ts` — **not touched**

---

## ST-1: Constants

**Intent:** Define all string constants for view ID and command IDs in one place, following the existing `kaoto.<feature>.<action>` naming convention used throughout `src/constants.ts`.

**Expected Outcomes:**
- `src/constants.ts` has five new exported constants
- No other file is changed in this sub-task

**Todo List:**
1. Open `src/constants.ts`
2. Add after the existing `VIEW_*` block:
   ```
   export const VIEW_BOB_MODES = 'kaoto.bobModes';
   ```
3. Add after the existing `COMMAND_*` block (group with other bob-mode commands):
   ```
   export const COMMAND_BOB_MODES_REFRESH    = 'kaoto.bobModes.refresh';
   export const COMMAND_BOB_MODES_SHOW_SOURCE = 'kaoto.bobModes.showSource';
   export const COMMAND_BOB_MODES_TRY        = 'kaoto.bobModes.tryMode';
   export const COMMAND_BOB_MODES_CREATE     = 'kaoto.bobModes.create';
   ```

**Relevant Context:**
- `src/constants.ts` — existing `VIEW_INTEGRATIONS`, `VIEW_TESTS`, `COMMAND_INTEGRATIONS_REFRESH`, `COMMAND_TESTS_REFRESH` as naming examples

---

## ST-2: BobModeItem Tree Item

**Intent:** Create the `TreeItem` subclass that represents a single mode entry. It encapsulates all display and behavior properties so the provider stays thin.

**Expected Outcomes:**
- New file `src/extension/bob/BobModeItem.ts` compiles without errors
- Item displays `name` as label and `slug` as description; falls back to `slug` as label if `name` is absent
- Clicking the item opens the modes file in the Kaoto editor (`vscode.openWith`)
- `contextValue = 'bobMode'` enables right-click menu and inline button

**Todo List:**
1. Create `src/extension/bob/BobModeItem.ts`:
   - `import { TreeItem, TreeItemCollapsibleState, ThemeIcon, Uri, Command } from 'vscode'`
   - `import { COMMAND_BOB_MODES_TRY } from '../../constants'`
   - Constructor parameters: `slug: string`, `name: string | undefined`, `fileUri: Uri`, `line: number`
   - Call `super(name ?? slug, TreeItemCollapsibleState.None)`
   - Set `this.description = slug` (always show slug as description regardless of label)
   - Set `this.iconPath = new ThemeIcon('symbol-misc')`
   - Set `this.contextValue = 'bobMode'`
   - Set `this.tooltip = name ?? slug`
   - Set `this.command` to open the file in Kaoto editor:
     ```typescript
     this.command = {
       command: 'vscode.openWith',
       title: 'Open in Kaoto',
       arguments: [fileUri, 'webviewEditorsKaoto'],
     };
     ```
   - Store `this.line = line` as a public readonly property (used by "Show Source")
   - Store `this.fileUri = fileUri` as public readonly (used by "Show Source")

**Relevant Context:**
- `src/views/integrationTreeItems/Integration.ts` — `command` property pattern, `contextValue` static constant
- `src/views/testTreeItems/Test.ts` — `TreeItemCollapsibleState.None`, ThemeIcon usage
- `src/views/providers/HelpFeedbackProvider.ts` lines 67–84 — minimal TreeItem extending TreeItem

---

## ST-3: BobModesProvider

**Intent:** Implement the `TreeDataProvider` that reads the modes file, exposes items to the tree view, and auto-refreshes when the file changes.

**Expected Outcomes:**
- New file `src/extension/bob/BobModesProvider.ts` compiles without errors
- Provider parses `customModes` array from `.bob/custom_modes.yaml`
- Provider returns a flat list of `BobModeItem` at root level; returns `[]` for any non-root call
- `FileSystemWatcher` on `**/.bob/custom_modes.yaml` triggers `refresh()` on create/change/delete
- `tryBobMode` stub is implemented as an exported function (Dominik replaces body later)
- Provider has a `dispose()` method that disposes the file watcher

**Todo List:**

1. Create `src/extension/bob/BobModesProvider.ts`

2. **Imports:**
   - `vscode` (EventEmitter, Event, TreeDataProvider, TreeItem, FileSystemWatcher, workspace, window, Uri, Range, Position)
   - `{ parse } from 'yaml'`
   - `{ readFileSync, existsSync } from 'fs'`
   - `{ join } from 'path'`
   - `BobModeItem from './BobModeItem'`
   - `KaotoOutputChannel` (existing output channel utility — follow import from `IntegrationsProvider`)
   - constants: `COMMAND_BOB_MODES_TRY`

3. **`BobModesProvider` class** implementing `TreeDataProvider<BobModeItem>`:

   ```
   private _onDidChangeTreeData = new EventEmitter<BobModeItem | undefined | null | void>()
   readonly onDidChangeTreeData = this._onDidChangeTreeData.event
   private fileWatcher: FileSystemWatcher
   ```

   Constructor:
   - Create `FileSystemWatcher` for `**/.bob/custom_modes.yaml`
   - Attach `onDidChange`, `onDidCreate`, `onDidDelete` all to `this.refresh.bind(this)`

   `getTreeItem(item: BobModeItem): BobModeItem` — return item as-is (same as `HelpFeedbackProvider`)

   `getChildren(item?: BobModeItem): Thenable<BobModeItem[]>`:
   - If `item` is defined → return `Promise.resolve([])`  (leaf nodes)
   - Otherwise → call `this.loadModes()` and return the result

   `refresh(): void`:
   - `this._onDidChangeTreeData.fire()`

   `dispose(): void`:
   - `this.fileWatcher?.dispose()`

4. **Private `loadModes()` method:**

   File resolution logic:
   - Get `workspaceFolders[0]` — if none, return `[]`
   - Check `.bob/custom_modes.yaml`; if not found, return `[]`

   YAML parsing:
   - Read file with `readFileSync(filePath, 'utf8')`
   - Parse with `parse(content)` from `yaml`
   - Extract `parsed?.customModes` array; if missing or not an array, return `[]`

   Source-line scan (for "Show Source"):
   - Read the raw file content line by line
   - Use regex `/^\s*-\s*slug:\s*(.+)$/` to find `- slug:` lines
   - Build a `Map<string, number>` from `slug → zero-based line number`

   Build items:
   - For each entry in `customModes`: create a `BobModeItem(slug, name, fileUri, lineNumber)`
   - If `slug` is missing in an entry, skip that entry (log a warning to the output channel)
   - If `line` for a slug is not found in the source map, use `0` as fallback

5. **Exported `tryBobMode` function** (fully implemented — Bob chat integration already done):

   Rather than a stub, the full Bob chat integration was implemented directly. `tryBobMode` shows the input box, builds the Bob prompt, then delegates to a private `sendToBobChat` helper that tries:
   1. `bob-code.newTask` (Bob v1 API)
   2. `bob-code.sendMessageWithHiddenPrompt(undefined, prompt)` (Bob v2 API, two-argument signature)
   3. Clipboard fallback with an info message if neither command is available

   Dominik's WI-2 (CodeLens) and WI-5 (Channel API) can reuse or reference this implementation directly — no stub replacement needed.

**Relevant Context:**
- `src/views/providers/HelpFeedbackProvider.ts` — `getTreeItem` / `getChildren` flat pattern
- `src/views/providers/IntegrationsProvider.ts` lines 31–72 — EventEmitter + FileSystemWatcher + refresh
- `src/views/providers/IntegrationsProvider.ts` line 18 — `import { parse } from 'yaml'`
- `KaotoOutputChannel` — check how it is imported in other providers

---

## ST-4: package.json Wiring

**Intent:** Declare the new view, commands, menus, and welcome content in `package.json` so VS Code knows about them at activation time.

**Expected Outcomes:**
- `kaoto.bobModes` view appears in the Kaoto sidebar between Tests and Help & Feedback
- Refresh button appears in the view title bar
- Right-click context menu shows "Show Source" for `bobMode` items
- Inline ▶ (play) button appears on each `bobMode` item
- Welcome content is shown when no modes are found (workspace open) or a "Open Folder" prompt when no workspace

**Todo List:**

1. **`contributes.views["kaoto-view"]`** — add after the `kaoto.tests` entry:
   ```json
   {
     "id": "kaoto.bobModes",
     "name": "Bob IDE Modes",
     "contextualTitle": "Kaoto",
     "icon": "icons/kaoto.png",
     "initialSize": 2
   }
   ```
   Note: no `when` clause — the view is always visible so welcome content can be displayed.

2. **`contributes.commands`** — add four new command entries:
   ```json
   { "command": "kaoto.bobModes.refresh",    "title": "Refresh",       "category": "Kaoto", "icon": "$(refresh)" },
   { "command": "kaoto.bobModes.showSource", "title": "Show Source",   "category": "Kaoto", "icon": "$(go-to-file)" },
   { "command": "kaoto.bobModes.tryMode",    "title": "Try It...",     "category": "Kaoto", "icon": "$(play)" },
   { "command": "kaoto.bobModes.create",     "title": "New Custom Mode...", "category": "Kaoto" }
   ```

3. **`contributes.menus["view/title"]`** — add refresh button:
   ```json
   {
     "command": "kaoto.bobModes.refresh",
     "group": "navigation",
     "when": "view == kaoto.bobModes"
   }
   ```

4. **`contributes.menus["view/item/context"]`** — add Show Source (context menu) and Try It (inline):
   ```json
   {
     "command": "kaoto.bobModes.showSource",
     "when": "view == kaoto.bobModes && viewItem == bobMode",
     "group": "inline@2"
   },
   {
     "command": "kaoto.bobModes.tryMode",
     "when": "view == kaoto.bobModes && viewItem == bobMode",
     "group": "inline@1"
   },
   {
     "command": "kaoto.bobModes.showSource",
     "when": "view == kaoto.bobModes && viewItem == bobMode",
     "group": "navigation@1"
   }
   ```

5. **`contributes.viewsWelcome`** — add two entries for the Bob Modes view:
   ```json
   {
     "view": "kaoto.bobModes",
     "contents": "No custom modes found in this workspace.\nCreate a custom_modes.yaml file to start designing Bob IDE modes visually with Kaoto.\n[New Custom Mode...](command:kaoto.bobModes.create)\nTo learn more about Bob IDE custom modes [read docs](https://bob.ibm.com/docs/ide/features/custom-modes).",
     "when": "workspaceFolderCount > 0"
   },
   {
     "view": "kaoto.bobModes",
     "contents": "Open a folder to manage Bob IDE custom modes.\n[Open Folder](command:vscode.openFolder)",
     "when": "workspaceFolderCount == 0"
   }
   ```

**Relevant Context:**
- `package.json` lines 1271–1310 — existing `kaoto-view` views block
- `package.json` lines 281–350 — existing commands block
- `package.json` lines 739–795 — existing `view/title` menus
- `package.json` lines 796–897 — existing `view/item/context` menus
- `package.json` lines 906–937 — existing `viewsWelcome` block

---

## ST-5: BobModesRegistrar and extension.ts call

**Intent:** Wire the provider, commands, and file watcher into the extension lifecycle in a fully isolated module. `ExtensionContextHandler.ts` is not touched. All Bob-specific registration logic lives in `src/extension/bob/BobModesRegistrar.ts`.

**Expected Outcomes:**
- New file `src/extension/bob/BobModesRegistrar.ts` contains one exported function `registerBobModes(context)`
- `ExtensionContextHandler.ts` is **not modified**
- `extension.ts` adds one import and one call in the "register all views" block
- All subscriptions (tree view, dispose, commands) are pushed to `context.subscriptions`
- "Show Source" and "Try It…" commands are registered and functional
- "Create" command creates `.bob/custom_modes.yaml` with the starter template and opens it in Kaoto editor

**Todo List:**

1. **Create `src/extension/bob/BobModesRegistrar.ts`:**

   Imports:
   - `* as vscode from 'vscode'`
   - `BobModesProvider, tryBobMode` from `'./BobModesProvider'`
   - `BobModeItem` from `'./BobModeItem'`
   - `VIEW_BOB_MODES`, `COMMAND_BOB_MODES_REFRESH`, `COMMAND_BOB_MODES_SHOW_SOURCE`, `COMMAND_BOB_MODES_TRY`, `COMMAND_BOB_MODES_CREATE` from `'../../constants'`

   Single exported function:

   ```typescript
   export function registerBobModes(context: vscode.ExtensionContext): void {
     const provider = new BobModesProvider();
     const treeView = vscode.window.createTreeView(VIEW_BOB_MODES, {
       treeDataProvider: provider,
       showCollapseAll: false,
     });
     const dispose = { dispose: () => provider.dispose() };

     const refreshCmd = vscode.commands.registerCommand(
       COMMAND_BOB_MODES_REFRESH, () => provider.refresh()
     );

     const showSourceCmd = vscode.commands.registerCommand(
       COMMAND_BOB_MODES_SHOW_SOURCE,
       async (item: BobModeItem) => {
         const doc = await vscode.workspace.openTextDocument(item.fileUri);
         await vscode.window.showTextDocument(doc, {
           selection: new vscode.Range(
             new vscode.Position(item.line, 0),
             new vscode.Position(item.line, 0),
           ),
         });
       }
     );

     const tryCmd = vscode.commands.registerCommand(
       COMMAND_BOB_MODES_TRY,
       (item: BobModeItem) => tryBobMode(item.slug, item.label as string)
     );

     const createCmd = vscode.commands.registerCommand(
       COMMAND_BOB_MODES_CREATE,
       async () => {
         const wsFolders = vscode.workspace.workspaceFolders;
         if (!wsFolders?.length) return;
         const bobDir = vscode.Uri.joinPath(wsFolders[0].uri, '.bob');
         const targetUri = vscode.Uri.joinPath(bobDir, 'custom_modes.yaml');

         const yamlExists = await vscode.workspace.fs.stat(targetUri).then(() => true, () => false);

         if (!yamlExists) {
           const template = [
             'customModes:',
             '  - slug: my-custom-mode',
             '    name: My Custom Mode',
             '    description: Describe what this mode does',
             '    roleDefinition: "Define the AI\'s role and expertise"',
             '    whenToUse: Describe when this mode should be used',
             '    customInstructions: ""',
             '    groups: []',
           ].join('\n');
           await vscode.workspace.fs.createDirectory(bobDir);
           await vscode.workspace.fs.writeFile(targetUri, Buffer.from(template, 'utf8'));
         }

         await vscode.commands.executeCommand('vscode.openWith', targetUri, 'webviewEditorsKaoto');
         provider.refresh();
       }
     );

     context.subscriptions.push(treeView, dispose, refreshCmd, showSourceCmd, tryCmd, createCmd);
   }
   ```

2. **`src/extension/extension.ts`:**

   Add import at the top (alongside other extension imports):
   ```typescript
   import { registerBobModes } from './bob/BobModesRegistrar';
   ```

   Add one call in the "register all views" block, after `registerOpenApiView()`:
   ```typescript
   /*
    * register Bob IDE Modes view and commands
    */
   registerBobModes(context);
   ```

**Relevant Context:**
- `src/extension/extension.ts` lines 103–109 — existing "register all views" block; new call goes after line 109
- `src/extension/bob/BobModesProvider.ts` (ST-3) — `BobModesProvider`, `tryBobMode`
- `src/extension/bob/BobModeItem.ts` (ST-2) — `BobModeItem.fileUri`, `.line`, `.slug`, `.label`

---

## Notes for Implementation

- **No `when` clause on the view** — omit the `when` field from the view declaration in `package.json`; the welcome content `when` conditions handle the empty-state display
- **`tryBobMode` takes `item.label as string`** — because `BobModeItem` sets `label = name ?? slug`, this is always the mode name; but the `slug` is also passed so Dominik can use it if needed
- **Error handling in `loadModes()`** — wrap the parse in a try/catch and log to `KaotoOutputChannel` on failure; return `[]` so the tree view shows the welcome state rather than crashing
- **`showCollapseAll: false`** — flat list, no collapse needed (unlike `showCollapseAll: true` for Integrations)
