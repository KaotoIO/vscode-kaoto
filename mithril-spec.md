---
name: Bob IDE Custom Modes Support
overview: "Add Bob IDE Custom Modes support to vscode-kaoto: a Modes tree view in the Kaoto sidebar, CodeLens on slug lines, Kaoto editor for custom_modes.yaml/.yml, and Bob chat integration for testing modes via prompt injection."
todos:
  - id: wi-1-tree-view
    content: "WI-1: Bob IDE Modes tree view -- BobModesProvider, BobModeItem, package.json views/commands/menus, registration, Try It prompt flow"
    status: pending
  - id: wi-2-codelens
    content: "WI-2: CodeLens for custom_modes.yaml/.yml -- BobModeCodeLensProvider, Open in Kaoto + Try with Kaoto lenses"
    status: pending
  - id: wi-3-editor
    content: "WI-3: Kaoto custom editor for custom_modes.yaml/.yml -- package.json selector, KAOTO_FILE_PATH_GLOB update, Kaoto UI modes designer"
    status: pending
  - id: wi-5-channel-api
    content: "WI-5: Channel API extension -- tryBobMode method in VSCodeKaotoEditorChannelApi, Kaoto UI button integration"
    status: pending
isProject: false
---

# Bob IDE Custom Modes Support for vscode-kaoto

## Context

Bob IDE allows users to define custom AI modes in `.bob/custom_modes.yaml` or `.bob/custom_modes.yml`. This plan adds first-class support for these modes in Kaoto: a tree view for browsing/testing them, CodeLens in the source editor, Kaoto visual editor support, and Bob chat integration for trying modes.

### Existing foundation (prototyped by Dominik)

Two core capabilities have been prototyped and verified working inside Bob IDE:

**1. Bob Chat Prompt Injection**

- Activates `IBM.bob-code` extension via `vscode.extensions.getExtension('IBM.bob-code')`
- Tries `bob-code.newTask` with `{ prompt }` (Bob v1), then `bob-code.sendMessageWithHiddenPrompt` with `undefined, prompt` (Bob v2), then clipboard fallback
- The two-argument signature for `sendMessageWithHiddenPrompt` was reverse-engineered from IBM's Propel extension
- Shows an input box for user to review/edit the prompt before sending

**2. CodeLens on slug lines**

- `BobModeCodeLensProvider` registered for `**/.bob/custom_modes.{yaml,yml}`
- Scans for `- slug:` lines using regex `^(\s*-\s*slug:\s*)(.+)$`
- Shows `Open in Kaoto | Try with Kaoto` above each slug line
- "Try with Kaoto" extracts the full YAML mode block and sends it to Bob chat

Both will be contributed by Dominik to the main repository. Lars does not depend on this code.

---

## File Format

Supported filenames:

- `.bob/custom_modes.yaml` (canonical filename created by Kaoto)
- `.bob/custom_modes.yml` (fallback only, supported when it already exists)
- Do not support the singular `custom_mode.yaml` / `custom_mode.yml` filename

Filename priority:

- Prefer `.bob/custom_modes.yaml` whenever creating or choosing a default file
- Use `.bob/custom_modes.yml` only as a fallback when that file already exists
- If both `.yaml` and `.yml` exist in the workspace `.bob` folder, prefer `.yaml`

Workspace scope:

- This feature assumes VS Code opens a single workspace folder
- Therefore there is only one `.bob` folder to inspect
- Do not aggregate modes across multiple workspace folders

Example file:

```yaml
customModes:
  - slug: my-mode-1
    name: Mithril 1
    description: My Awesome Mithril Superpowers Mode
    roleDefinition: I am the best mode...
    whenToUse: This mode should be used for...
    customInstructions: ""
    groups: []
  - slug: my-mode-2
    name: Mithril 2
    ...
```

Field expectations:

- `slug` and `name` are mandatory fields
- Use `name` as the tree item label
- If `name` is missing in an invalid or older file, fall back to `slug` as the tree item label

---

## Work Items

### WI-1: "Bob IDE Modes" Tree View (Lars)

Add a new flat tree view in the Kaoto sidebar that lists all modes from `.bob/custom_modes.yaml` or `.bob/custom_modes.yml`.

**package.json changes:**

- Add view `kaoto.bobModes` under `kaoto-view` in `contributes.views` (alongside Integrations, Deployments, Tests, etc.)
- Add commands: `kaoto.bobModes.refresh`, `kaoto.bobModes.showSource`, `kaoto.bobModes.tryMode`
- Add view/title menu (refresh button) and view/item/context menus (Show Source, inline Try It button)
- Do not add a view-level `when` clause; the Bob Modes view should always be visible in the Kaoto sidebar so the empty-state welcome content can guide users to create `.bob/custom_modes.yaml`

**New file: `src/views/providers/BobModesProvider.ts`**

- Implements `TreeDataProvider<BobModeItem>`
- Flat structure: each `- slug:` entry in the YAML becomes a root-level `BobModeItem`
- Parses `custom_modes.yaml` / `custom_modes.yml` using the `yaml` library (already a dependency)
- `FileSystemWatcher` on `**/.bob/custom_modes.{yaml,yml}` for auto-refresh
- In the workspace folder, prefer `.bob/custom_modes.yaml`; fall back to `.bob/custom_modes.yml` only if `.yaml` does not exist
- Each `BobModeItem` displays the mode `name` as label and `slug` as description; fall back to `slug` as label only if `name` is missing
- Uses the parsed YAML for mode data and a lightweight source-line scan for `- slug:` lines to resolve the line number used by "Show Source"

**New file: `src/views/bobModeTreeItems/BobModeItem.ts`**

- Extends `vscode.TreeItem`
- Properties: `slug`, `name`, `description`, `line` (line number in YAML for "Show Source")
- On click (`command` property): opens the file in Kaoto editor (`vscode.openWith` using `webviewEditorsKaoto`)
- `contextValue: 'bobMode'` for right-click context menu matching
- Inline button: "Try It..." icon `$(play)` triggers `kaoto.bobModes.tryMode`

**Welcome content (empty state -- no modes found):**

When the view is empty, show VS Code's native `viewsWelcome` content:

```
No custom modes found in this workspace.
Create a custom_modes.yaml file to start designing Bob IDE modes visually with Kaoto.

[New Custom Mode...](command:kaoto.bobModes.create)

To learn more about Bob IDE custom modes [read docs](https://bob.ibm.com/docs/ide/features/custom-modes).
```

Declared in `package.json` under `contributes.viewsWelcome`:

- `when: "workspaceFolderCount > 0"` -- workspace open but no modes are listed
- `when: "workspaceFolderCount == 0"` -- no workspace open, show "Open Folder" button

**Scaffold command `kaoto.bobModes.create`:**

- Creates `.bob/custom_modes.yaml` with a starter template containing one example mode
- If `.bob/custom_modes.yaml` or `.bob/custom_modes.yml` already exists, open the existing file instead of creating a second one; prefer `.yaml` if both exist
- Opens the file in Kaoto editor via `vscode.openWith(uri, 'webviewEditorsKaoto')`
- Refreshes the tree view

Template content:

```yaml
customModes:
  - slug: my-custom-mode
    name: My Custom Mode
    description: Describe what this mode does
    roleDefinition: Define the AI's role and expertise
    whenToUse: Describe when this mode should be used
    customInstructions: ""
    groups: []
```

**Registration in `ExtensionContextHandler.ts`:**

- New method `registerBobModesView()` following the same pattern as `registerTestsView()` or `registerIntegrationsView()`
- No visibility context key is needed; the view is always visible, and the provider returns an empty list when no `.bob/custom_modes.yaml` or `.bob/custom_modes.yml` file exists
- Registers refresh command, show source command, try mode command, and create command

**"Try It..." behavior (final, after Dominik's integration):**

1. User clicks the inline `$(play)` button on a mode item
2. Extension shows `showInputBox` for the actual user prompt only
3. Extension builds the final Bob prompt by prepending the mode switch call: `Switch to <mode-name> mode. `
4. On confirmation, the generated Bob prompt is sent to Bob via `sendMessageWithHiddenPrompt(undefined, bobPrompt)`

**Note:** Lars implements steps 1-2 with a stub action (log + info message). Dominik later wires step 3 to the real Bob chat call. See the integration contract below.

**"Show Source" behavior (right-click):**

- Opens `custom_modes.yaml` / `custom_modes.yml` in text editor
- Jumps to the line of the corresponding `- slug:` entry using `vscode.window.showTextDocument(uri, { selection: range })`
- If the slug line cannot be resolved, opens the file without a selection

---

### WI-2: CodeLens for `custom_modes.yaml` / `custom_modes.yml` Source Editor (Dominik)

When `custom_modes.yaml` or `custom_modes.yml` is open in a **text editor** (not Kaoto), show CodeLens buttons above each `- slug:` line.

**New file: `src/commands/BobModeCodeLensProvider.ts`**

- `BobModeCodeLensProvider` implements `vscode.CodeLensProvider`
- Registered for `{ language: 'yaml', pattern: '**/.bob/custom_modes.{yaml,yml}' }`
- Two lenses per slug line: `Open in Kaoto` and `Try with Kaoto`
- "Try with Kaoto" follows the same prompt flow as the tree view: shows an input box for the actual user prompt, prepends `Switch to <mode-name> mode. ` in the extension, then sends the generated Bob prompt

**Shared logic:**

- Extract `tryBobMode()` and the Bob chat send logic into a shared utility (or keep in the same file) so both the tree view and CodeLens use the same prompt-injection path

---

### WI-3: Kaoto Custom Editor for `custom_modes.yaml` / `custom_modes.yml` (Dominik + UI team)

Register `custom_modes.yaml` and `custom_modes.yml` as supported file types for the Kaoto editor.

**Extension side (Dominik):**

- Add `{ "filenamePattern": "custom_modes.{yaml,yml}" }` to `customEditors[0].selector` in `package.json`
- The existing `EditorEnvelopeLocator` glob (`KAOTO_FILE_PATH_GLOB`) may need to include this pattern

**UI side (UI team, separate `@kaoto/kaoto` repo):**

- Render a modes designer canvas when the Kaoto editor opens a `custom_modes.yaml` or `custom_modes.yml` file
- This is the visual editor for designing modes on the Kaoto canvas

---

### WI-4: Activation Event (intentionally ignored)

No activation event is needed for Bob modes.

The Kaoto extension already activates via the existing startup activation path, so do **not** add `"workspaceContains:**/.bob/custom_modes.yaml"` or `"workspaceContains:**/.bob/custom_modes.yml"` to `activationEvents`. Keeping the Bob Modes view always visible also ensures that the native `viewsWelcome` empty state can be shown when the modes file does not exist yet.

---

### WI-5: Channel API Extension (Dominik + UI team)

Extend the Kaoto editor channel API to support a "Try mode" action triggered from the Kaoto UI. The extension-side method prototype is owned by Dominik. The Kaoto UI team consumes it from their canvas.

**Extension side (Dominik) -- `src/webview/VSCodeKaotoEditorChannelApi.ts`:**

- Add a new method `tryBobMode(slug: string, modeName: string, prompt?: string)` to the channel API
- The `prompt` parameter is optional -- two UX approaches are possible (to be decided later):

**Option A: Prompt input on VS Code side (closer to VS Code UX)**

- UI team calls `channelApi.tryBobMode(slug, name)` without prompt
- Extension shows `vscode.window.showInputBox` for the actual user prompt only
- Extension prepends `Switch to <modeName> mode. ` before sending the generated Bob prompt
- Simpler for UI team, consistent with VS Code native UX

**Option B: Prompt input on canvas side (closer to Kaoto UX)**

- UI team renders a styled input field in the canvas, user types prompt there
- UI team calls `channelApi.tryBobMode(slug, name, userPrompt)` with the actual user prompt already provided
- Extension prepends `Switch to <modeName> mode. ` before sending the generated Bob prompt, no input box needed
- Richer UX, consistent with Kaoto's visual design language

This decision does not block implementation -- the method signature supports both via the optional `prompt` parameter. Start with Option A (stub uses `showInputBox`), switch to Option B later if the UI team prefers canvas-side input.

**Kaoto UI side (UI team) -- separate `@kaoto/kaoto` repo:**

- The modes designer canvas calls `channelApi.tryBobMode(slug, name)` or `channelApi.tryBobMode(slug, name, prompt)` when the user clicks a "Try" button
- The UI team does not need to know about Bob IDE commands -- the extension side handles everything

---

## Files Summary

| File                                         | Action                                                    | Owner                       |
| -------------------------------------------- | --------------------------------------------------------- | --------------------------- |
| `package.json`                               | Add view, commands, menus                                 | Lars (WI-1), Dominik (WI-2) |
| `package.json`                               | Add editor selector for `custom_modes.yaml` / `.yml`      | Dominik (WI-3)              |
| `src/constants.ts`                           | Add `VIEW_BOB_MODES`, `COMMAND_BOB_MODES_*` constants     | Lars (WI-1)                 |
| `src/views/providers/BobModesProvider.ts`    | **New** -- tree data provider for modes                   | Lars (WI-1)                 |
| `src/views/bobModeTreeItems/BobModeItem.ts`  | **New** -- tree item for a single mode                    | Lars (WI-1)                 |
| `src/commands/BobModeCodeLensProvider.ts`    | **New** -- CodeLens provider for slug lines               | Dominik (WI-2)              |
| `src/commands/SendPromptToChatCommand.ts`    | **New** -- Bob chat prompt injection                      | Dominik                     |
| `src/extension/ExtensionContextHandler.ts`   | Add `registerBobModesView()`, `registerBobModeCodeLens()` | Lars (WI-1), Dominik (WI-2) |
| `src/extension/extension.ts`                 | Call new registration methods                             | Lars (WI-1), Dominik (WI-2) |
| `src/webview/VSCodeKaotoEditorChannelApi.ts` | Add `tryBobMode()` method prototype                       | Dominik (WI-5)              |

---

## Team and Schedule

### Scope

Extension team owns: WI-1 (tree view), WI-2 (CodeLens), WI-3 package.json selector, WI-5 extension-side method prototype, and the Bob chat integration wiring. The Kaoto UI team owns WI-3 canvas rendering and WI-5 UI-side button. WI-4 is intentionally ignored because no additional activation event is needed.

### People

- **Dominik** -- investigated Bob IDE integration, built a working prototype (prompt injection + CodeLens). On PTO the first days. Contributes Bob chat integration, CodeLens, and channel API method after returning.
- **Lars** -- starts implementation while Dominik is out. Owns the tree view (WI-1).

### What Dominik has prototyped (not yet in main repo)

- Bob chat prompt injection via `bob-code.sendMessageWithHiddenPrompt(undefined, prompt)` with input box confirmation and clipboard fallback
- Runtime probe that discovers all `bob-code.*` / `chat.*` commands in Bob IDE
- CodeLens provider showing "Open in Kaoto" and "Try with Kaoto" above `- slug:` lines
- The two-argument signature for `sendMessageWithHiddenPrompt` was reverse-engineered from IBM's Propel extension and verified working inside Bob IDE

### Work split

The split is designed so Lars can work **fully independently** without any dependencies on Dominik's code. The Bob chat integration (`sendMessageWithHiddenPrompt`, CodeLens) will be contributed by Dominik separately. Lars's tree view should use a **simple stub** for the "Try It..." action that Dominik replaces with the real Bob chat call later.

**Lars (starts immediately, no dependencies):**

1. **WI-1: Bob IDE Modes tree view** -- the main work item:
   - Create `BobModesProvider.ts` (tree data provider, YAML parsing with `yaml` npm package, file watcher)
   - Create `BobModeItem.ts` (tree item with slug, name, line number)
   - Add `kaoto.bobModes` view to `package.json` views, commands, menus
   - Keep the view always visible; do not add a `kaoto.bobModesFileExists` visibility context or activation event
   - Add welcome content for empty state + `kaoto.bobModes.create` scaffold command
   - Add `registerBobModesView()` in `ExtensionContextHandler.ts`
   - Wire "Show Source" right-click to open text editor at the slug line
   - **"Try It..." stub**: implement the inline button and input box flow, but use a **placeholder action** (e.g., log to output channel + show info message "Prompt ready: ..."). Do NOT depend on `sendMessageWithHiddenPrompt` or any worktree code. Use a constant like `COMMAND_BOB_MODES_TRY` and a simple handler that Dominik will later replace with the real Bob chat call.

   For the flat tree structure, follow `HelpFeedbackProvider` as the closest pattern -- it implements `TreeDataProvider` directly (no `AbstractFolderTreeProvider`), returns all items at root level, `[]` for children, and uses `TreeItemCollapsibleState.None`. For inline action buttons (play icon), borrow the `view/item/context` menu wiring pattern from Tests/OpenApi in `package.json`, keyed on `contextValue`. For the file watcher and refresh, follow the `EventEmitter` + `onDidChangeTreeData` pattern from `IntegrationsProvider`. The welcome content follows the exact same pattern as `kaoto.integrations` and `kaoto.tests` in `package.json` under `viewsWelcome`. Use the `yaml` npm package (already a project dependency) to parse `custom_modes.yaml` / `custom_modes.yml`.

**Dominik (after PTO / during PTO when available):**

1. **Bob chat integration** -- contribute `SendPromptToChatCommand.ts`, `TestBobIntegrationCommand.ts`, and their constants/registration. Wire Lars's "Try It..." stub to the real `sendMessageWithHiddenPrompt` call. The key call: `vscode.commands.executeCommand('bob-code.sendMessageWithHiddenPrompt', undefined, bobPrompt)`.

2. **WI-2: CodeLens** -- contribute `BobModeCodeLensProvider.ts` with "Open in Kaoto" and "Try with Kaoto" lenses above `- slug:` lines, ensure shared prompt logic between tree view and CodeLens.

3. **WI-5: Channel API method prototype** -- add `tryBobMode(slug, modeName, prompt?)` to `VSCodeKaotoEditorChannelApi.ts` on the extension side. This is the bridge the Kaoto UI team will call from their canvas. The extension-side implementation calls the same `sendMessageWithHiddenPrompt` path. The Kaoto UI team only needs to invoke this method from their button -- they don't touch Bob commands. See WI-5 section for Option A vs Option B UX decision.

4. **Integration polish + cleanup** -- review Lars's tree view, add `package.json` command declarations for all Bob commands, remove any exploratory code.

### Integration contract between Lars and Dominik

Lars creates the "Try It..." command handler as a simple function that receives `{ slug, name }`, asks for the actual user prompt, generates the Bob prompt with the mode switch prefix, and does a placeholder action. Dominik later replaces the placeholder with the Bob chat call. Agreed interface:

```typescript
// Lars implements this with a stub (log + info message)
// Dominik replaces the body with sendMessageWithHiddenPrompt
export async function tryBobMode(slug: string, modeName: string): Promise<void> {
  const userPrompt = await vscode.window.showInputBox({
    title: `Try mode: ${modeName}`,
    prompt: "Enter the prompt to send to Bob in this mode. Press Escape to cancel.",
    ignoreFocusOut: true,
  });
  if (!userPrompt) return;

  const bobPrompt = `Switch to ${modeName} mode.\n\n${userPrompt}`;

  // STUB -- Dominik replaces this with bob-code.sendMessageWithHiddenPrompt
  KaotoOutputChannel.logInfo(`[stub] Would send to Bob: ${bobPrompt}`);
  vscode.window.showInformationMessage(`Prompt ready: ${bobPrompt}`);
}
```

### Handoff notes for Lars

**Tree view implementation:**

- For the flat tree structure: follow `HelpFeedbackProvider` as the closest pattern -- implements `TreeDataProvider` directly (not `AbstractFolderTreeProvider`), returns all items at root level, `[]` for children. Note: `TestsProvider` / `OpenApiProvider` use a hierarchical folder+files structure via `AbstractFolderTreeProvider` which is overkill for a flat mode list.
- For inline action buttons: borrow the `view/item/context` menu wiring from Tests/OpenApi in `package.json`, keyed on `contextValue` (e.g. `viewItem == bobMode`).
- For file watcher and refresh: follow the `EventEmitter` + `onDidChangeTreeData` pattern from `IntegrationsProvider`.
- Use the `yaml` npm package (already in `package.json` dependencies) to parse `custom_modes.yaml` / `custom_modes.yml`.
- Do not rely on the YAML parser for source locations; scan the source text for `- slug:` lines and map those slugs to line numbers for "Show Source".
- The welcome content follows the exact same pattern as `kaoto.integrations` and `kaoto.tests` in `package.json` under `viewsWelcome`.

**"Try It..." stub:**

- Ask the user only for the actual prompt. Generate the Bob prompt in the extension by prepending `Switch to <mode-name> mode. ` before the user prompt.
- Implement the full input box UX (see integration contract above) but use a placeholder action (log + info message). Dominik replaces the stub body with the real Bob chat call later.

**What Lars does NOT need to touch:**

- Bob chat API (`sendMessageWithHiddenPrompt`) -- Dominik
- CodeLens provider -- Dominik
- Channel API method in `VSCodeKaotoEditorChannelApi.ts` -- Dominik
- `TestBobIntegrationCommand` / `SendPromptToChatCommand` -- Dominik
- Any `IBM.bob-code` extension activation or command discovery -- Dominik

**Handoff notes for the Kaoto UI team:**

Dominik will provide a `tryBobMode` method on the channel API (`VSCodeKaotoEditorChannelApi`). The UI team calls it from their "Try mode..." button in the modes designer canvas. They do not need to know about Bob IDE commands -- the extension side handles everything.

```typescript
// Channel API method (extension side, provided by Dominik)
tryBobMode(slug: string, modeName: string, prompt?: string): Promise<void>
```

- If `prompt` is omitted: extension shows a VS Code input box for the actual user prompt (Option A)
- If `prompt` is provided: extension treats it as the actual user prompt, no input box (Option B -- use this if the UI team wants to render a styled input in the canvas)
- Extension always prepends `Switch to <modeName> mode. ` before the actual user prompt to build the Bob prompt
- Sends to Bob chat via `sendMessageWithHiddenPrompt` or falls back to clipboard
- The decision on Option A vs B can be made later without changing the method signature

---

## Appendix: Available `bob-code` Commands in Bob IDE

Reference list of all Bob IDE commands discovered at runtime. Commands marked **(used)** are the ones our integration relies on.

**User-facing commands (Source: IBM Bob):**

| Command ID                                 | Title                               | Notes                                      |
| ------------------------------------------ | ----------------------------------- | ------------------------------------------ |
| `bob-code.addToContext`                    | Bob: Add to Context                 | Adds selected code to conversation context |
| `bob-code.cancelCommitGeneration`          | Bob: Cancel Commit Generation       |                                            |
| `bob-code.task.wipe`                       | Bob: Clear Chat History             |                                            |
| `bob-code.createPullRequest`               | Bob: Create Pull Request            |                                            |
| `bob-code.explainCode`                     | Bob: Explain Code                   | Explains selected code                     |
| `bob-code.explainFile`                     | Bob: Explain with Bob (File)        |                                            |
| `bob-code.explainFolder`                   | Bob: Explain with Bob (Folder)      |                                            |
| `bob-code.task.exportCurrent`              | Bob: Export Current Task            |                                            |
| `bob-code.task.export`                     | Bob: Export Task History            |                                            |
| `bob-code.generateCommitMessage`           | Bob: Generate Commit Message        |                                            |
| `bob-code.task.import`                     | Bob: Import Task History            |                                            |
| `bob-code.improveCode`                     | Bob: Improve Code                   | Suggests improvements                      |
| `bob-code.task.pickWorkspace`              | Bob: New Task                       |                                            |
| `bob-code.task.pickWorkspaceInEditor`      | Bob: New Task in Editor             |                                            |
| `bob-code.reviewView.openSettings`         | Bob: Open Review Settings           |                                            |
| `bob-code.reportIssue`                     | Bob: Report Issue                   |                                            |
| `bob-code.openSettings`                    | Bob: Settings                       |                                            |
| `bob-code.task.workflow`                   | Bob: Start Workflow                 |                                            |
| `bob-code.task.history`                    | Bob: Tasks                          |                                            |
| `bob-code.task.historyWithNotification`    | Bob: Tasks (with notification)      |                                            |
| `bob-code.checkForUpdates`                 | IBM Bob: Check for Updates          |                                            |
| `bob-code.onboarding.reopenSettingsImport` | IBM Bob: Reopen IDE Settings Import |                                            |

**System/internal commands:**

| Command ID                                 | Notes                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `bob-code.bobButtonAction`                 | View: Open Bob                                                         |
| `bob-code.ctrlKAction`                     | Inline edit (Cmd+K)                                                    |
| `bob-code.ctrlLAction`                     | Move to Chat (Cmd+L)                                                   |
| `bob-code.sendMessageWithHiddenPrompt`     | **(used)** Sends prompt to Bob chat -- args: `(undefined, promptText)` |
| `bob-code.SidebarProvider.focus`           | Focuses Bob sidebar panel                                              |
| `bob-code.literateCoding.toggleMode`       | Toggle Literate Coding Mode (Cmd+I)                                    |
| `bob-code.literateCoding.generateAccept`   | Generate/Accept (Enter)                                                |
| `bob-code.literateCoding.sendToChat`       | Send Literate Code to Chat (Enter)                                     |
| `bob-code.literateCoding.rejectClearAll`   | Stop/Reject/Clear All                                                  |
| `bob-code.literateCoding.navigateNext`     | Next Literate Block Section                                            |
| `bob-code.literateCoding.navigatePrevious` | Previous Literate Block Section                                        |
| `bob-code.fixCode`                         | Fix code                                                               |
| `bob-code.generateDiffUsingLlm`            | Generate diff using LLM                                                |
| `bob-code.getAIContributions`              | Get AI contributions                                                   |
| `bob-code.getInlineEditSlashCommands`      | Get inline edit slash commands                                         |
| `bob-code.getRulesText`                    | Get rules text                                                         |
| `bob-code.sendFeedback`                    | Send feedback                                                          |
| `bob-code.showOsNotification`              | Show OS notification                                                   |
| `bob-code.startReviewWorkflow`             | Start review workflow                                                  |
| `bob-code.workspaceEdit.accept`            | Accept workspace edit                                                  |
| `bob-code.workspaceEdit.reject`            | Reject workspace edit                                                  |
| `bob-code.extensionSyncUpdated`            | Extension sync updated                                                 |
| `bob-code.appConfigUpdated`                | App config updated                                                     |
| `bob-code.captureTelemetryEvent`           | Capture telemetry event                                                |
| `bob-code.findings.takeAction`             | Findings: take action                                                  |

**Bob view commands:**

| Command ID                                               | Notes                             |
| -------------------------------------------------------- | --------------------------------- |
| `bobChatView.open` / `.focus` / `.resetViewLocation`     | Bob chat panel                    |
| `bobFindingsView.open` / `.focus` / `.resetViewLocation` | Bob findings panel                |
| `bobReviewView.open` / `.focus` / `.resetViewLocation`   | Bob review panel                  |
| `bob-walkthroughs.chat.startPrompt`                      | Start a chat prompt (walkthrough) |
| `bob-walkthroughs.launchWalkthrough`                     | Launch walkthrough                |

**Bob chat prompt injection (Propel pattern -- verified working):**

```typescript
// Activate IBM.bob-code first
const bobExt = vscode.extensions.getExtension("IBM.bob-code");
if (bobExt && !bobExt.isActive) await bobExt.activate();

// Try Bob v1 API
await vscode.commands.executeCommand("bob-code.newTask", { prompt: text });

// Fallback: Bob v2 API -- note the two-argument signature
await vscode.commands.executeCommand("bob-code.sendMessageWithHiddenPrompt", undefined, text);
```
