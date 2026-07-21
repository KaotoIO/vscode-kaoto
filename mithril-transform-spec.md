# Kaoto Bob Mode Conversion Spec

> Source: `src/extension/bob/BobModeConstants.ts` · `BobModeConverter.ts` · `BobModesRegistrar.ts` · `constants.ts` — branch **mithril**

---

## 1 · Overview

The _Convert to Kaoto Format_ feature (`kaoto.bobModes.convertToKaoto`) turns a hand-written `.bob/custom_modes.yaml` into the **Kaoto canonical DSL**. The conversion is performed by the LLM (Bob Chat). The extension builds a structured prompt, sends it to Bob, and the user can copy-paste or directly save the result.

**Flow:**

1. Resolve `.bob/custom_modes.yaml` in the active workspace.
2. Validate: parse YAML, confirm `customModes` array exists.
3. Write timestamped backup: `custom_modes.backup.YYYY-MM-DD_HH-MM-SS.yaml`.
4. For the view-title button: show a QuickPick multi-select of all modes (all pre-selected); user picks a subset or keeps all. For a right-click on a single item: skip the picker and go directly with that mode's slug.
5. Build the LLM prompt (DSL reference + conversion phases + **full file** YAML).
6. Send to Bob Chat via `bob-code.newTask` → `sendMessageWithHiddenPrompt` → clipboard fallback.
7. Bob converts, assembles the full output, then calls `ask_followup_question` in chat: **"Write to file"** or **"Show here for copy-paste"**. User decides; Bob acts accordingly.

---

## 2 · Top-level YAML Schema

Every file must be a valid `customModes` YAML array at the root.

```yaml
customModes:
  - slug: <kebab-case-id>          # required  ^[a-z0-9-]+$
    name: <Human-readable name>    # required
    description: <short summary>   # optional
    roleDefinition: |              # required — persona / system prompt
      You are …
    whenToUse: |                   # optional — routing hint for orchestrator
      Use when …
    customInstructions: >          # Markdown; three zones (see §3)
      …
    groups:                        # optional; any subset of the values below
      - read | edit | execute | mcp | skill | todo | subtask | subagent | mode
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `slug` | **required** | string | kebab-case, `^[a-z0-9-]+$` |
| `name` | **required** | string | Human-readable display label |
| `description` | optional | string | Short one-line summary |
| `roleDefinition` | **required** | block scalar | LLM persona / system prompt |
| `whenToUse` | optional | block scalar | Routing hint for orchestrators |
| `customInstructions` | optional | folded scalar `>` | Kaoto DSL workflow — three zones |
| `groups` | optional | string[] | Tool-permission groups; any subset of the 9 values above |

---

## 3 · customInstructions — Three Zones

The `customInstructions` value is a single Markdown string divided into three logical zones. The Kaoto editor **strips Zone 1 and Zone 3 on parse** and **re-injects them on every save**. Only Zone 2 is user-editable on the canvas.

> **Important:** LLM conversion output must contain **only Zone 2** (the steps). Never include the preamble or trailer — Kaoto re-adds them automatically.

---

### Zone 1 — Preamble (auto-managed by Kaoto)

Always the first block. Constant text; cannot be edited via the canvas.

Source constant: `BOB_CUSTOM_INSTRUCTIONS_PREAMBLE` in `src/extension/bob/BobModeConstants.ts`

```
system instructions:

Follow the below instructions strictly. These directives are mandatory and
non-negotiable.

- You MUST call switch_mode AND spawn_subagent as actual tool calls for
EVERY specialist step. Performing the specialist work yourself inline is
STRICTLY FORBIDDEN.

- For each specialist step: (1) call switch_mode with the stage's mode_id,
then (2) immediately call spawn_subagent with a self-contained description
that includes the target mode's role and the exact JSON payload verbatim.

- The spawn_subagent description MUST start with: "You are running as the
<mode name> stage of the pipeline. Your input payload is:" followed by the
raw JSON block. Set fork_context: false.

- Collect the subagent's output as the $RESULT variable for that step
before proceeding. Never fabricate or infer subagent output — wait for the
actual tool response.

- Never skip either tool call. If a step requires both, both must be
issued as real tool invocations before moving to the next step.
```

---

### Zone 2 — Steps (the editable canvas content)

Numbered Markdown list items, each mapping to a canvas node. Two node types exist: **tool-invocation nodes** and **text nodes**. Free-form headings/paragraphs outside numbered items are preserved as-is.

See [§4 Step Node Syntax](#4--zone-2--step-node-syntax) for the full format.

---

### Zone 3 — Trailer (auto-managed by Kaoto)

Always the last block. Constant text; cannot be edited via the canvas.

Source constant: `BOB_CUSTOM_INSTRUCTIONS_TRAILER` in `src/extension/bob/BobModeConstants.ts`

```
> Hard rules

> - Do not invent content not present in the input.

> - Follow the output format specified in the final step exactly.
```

---

## 4 · Zone 2 — Step Node Syntax

### Tool-invocation node

Used when the step maps to one of the nine catalog tools. The bold title is the exact tool name; parameters are `-` sub-bullets (not `*`) at 3-space continuation indent:

```markdown
N. **tool_name**

   - requiredParam: value
   - optionalParam: value
```

### Text node (generic step)

Used for any step that does not map to a catalog tool. Title and body are copied verbatim from the source:

```markdown
N. Step label

   Body prose or bullet list describing what should happen.
   - detail one
   - detail two
```

### Free-form block

Headings, paragraphs, or unordered lists that sit _outside_ any numbered step. Kept in the same relative position, unchanged. Rendered as canvas text nodes.

```markdown
## Section heading
Any prose here becomes a single free-form canvas node.
```

---

## 5 · Bob Catalog — Tools & Component

Catalog URL: `https://raw.githubusercontent.com/djelinek/camel-catalog/refs/heads/mithril/catalog/index.json`
Bob catalog under `bob/1.0.0/`. The schemas below are inlined verbatim in every LLM conversion prompt.

---

### `bobTool` read_file

Read the contents of a file from the workspace.

| Parameter | | Type | Description |
|---|---|---|---|
| `path` | **required** | string | File path relative to workspace root |
| `range` | optional | string | Line range, e.g. `1-50` |

---

### `bobTool` write_file

Write content to a file (creates or overwrites).

| Parameter | | Type | Description |
|---|---|---|---|
| `path` | **required** | string | File path relative to workspace root |
| `content` | **required** | string | Full file content to write |
| `line_count` | optional | number | Predicted line count |

---

### `bobTool` execute_command

Run a CLI/shell command on the system.

| Parameter | | Type | Description |
|---|---|---|---|
| `command` | **required** | string | Bash command to execute |
| `cwd` | optional | string | Working directory relative to workspace root |
| `timeout_seconds` | optional | number | Max execution time (default 300) |

---

### `bobTool` ask_followup_question

Ask the user a question with selectable answer suggestions.

| Parameter | | Type | Description |
|---|---|---|---|
| `question` | **required** | string | The question to ask |
| `suggestion_a` | **required** | string | First answer option |
| `suggestion_b` | **required** | string | Second answer option |
| `suggestion_c` | optional | string | Third answer option |
| `suggestion_d` | optional | string | Fourth answer option |
| `allow_multiple` | optional | boolean | Allow selecting multiple answers |

---

### `bobTool` spawn_subagent

Spawn an independent subagent for a focused, isolated task.

| Parameter | | Type | Description |
|---|---|---|---|
| `name` | **required** | enum | `explore` (read-only) or `general` (full work) |
| `taskDescription` | **required** | string | Self-contained instructions for the subagent |
| `fork_context` | optional | boolean | Pass parent conversation history to subagent |

---

### `bobTool` start_subtask

Create a new subtask with its own title, instructions, and optional mode.

| Parameter | | Type | Description |
|---|---|---|---|
| `title` | **required** | string | Short display title |
| `message` | **required** | string | Detailed instructions for the subtask |
| `mode` | optional | string | Mode ID to use (default: `agent`) |
| `todos` | optional | string | Initial todo checklist in markdown |

---

### `bobTool` switch_mode

Switch to a different Bob mode.

| Parameter | | Type | Description |
|---|---|---|---|
| `mode_id` | **required** | string | Slug of the target mode |

---

### `bobTool` update_todo_list

Replace the current todo list with an updated checklist.

| Parameter | | Type | Description |
|---|---|---|---|
| `todos` | **required** | string | Full markdown checklist (`[ ]`, `[-]`, `[x]`) |

---

### `bobTool` use_skill

Activate a named skill to load its instructions into context.

| Parameter | | Type | Description |
|---|---|---|---|
| `skill_name` | **required** | string | Name of the skill to activate |

---

### `bobComponent` text-node

Generic free-text step — for any step that does not fit a specific tool. Renders as a plain numbered list item on the canvas.

| Parameter | | Type | Description |
|---|---|---|---|
| `content` | **required** | string | The instruction text (supports markdown) |
| `label` | optional | string | Short canvas label |

---

## 6 · LLM Conversion Phases

The LLM prompt (built by `buildConvertPrompt()` in `src/extension/bob/BobModeConverter.ts`) instructs the model to work through five phases in order.

### Phase 1 — Understand the mode

Read the entire source mode. Identify: overall purpose, every distinct step, and all concrete values (file paths, command strings, mode slugs, skill names, question text, todo items, subagent tasks).

### Phase 2 — Strip Zone 1 & Zone 3

Remove the `system instructions:` preamble and the `> Hard rules` trailer. The Kaoto editor re-injects both on every save; they must not appear in the LLM output.

### Phase 3 — Rewrite each step as a catalog node

Apply this decision table for every step:

| Step intent | Node to use |
|---|---|
| Read, inspect, or view a file | **`read_file`** |
| Write, create, save, or output to a file | **`write_file`** |
| Run a shell command, script, build, or test | **`execute_command`** |
| Ask the user a question or gather clarification | **`ask_followup_question`** |
| Delegate a self-contained task to a subagent | **`spawn_subagent`** |
| Create a new subtask or sub-workflow | **`start_subtask`** |
| Hand off to a different Bob mode | **`switch_mode`** |
| Record, update, or track a todo / checklist | **`update_todo_list`** |
| Load a named skill into context | **`use_skill`** |
| Anything else | **`text-node`** (generic) |

#### Parameter value sourcing rules

| Value availability | What to do |
|---|---|
| Explicit value in source | Copy verbatim as the parameter value |
| Implied by context | Extract and use it (path mentioned earlier, mode name in prose, etc.) |
| Genuinely absent | Use a terse `<descriptive-placeholder>` |
| Optional param with no source value | Omit entirely — never invent optional values |

#### Per-tool extraction guidance

| Tool | Required params — how to extract the value |
|---|---|
| `read_file` | **path**: extract file path from step text; placeholder `<file path>` if absent |
| `write_file` | **path**: output file path from step text; **content**: what the step says to write, or `<generated content>` |
| `execute_command` | **command**: the exact command string from the step, or `<command to run>` |
| `ask_followup_question` | **question**: the question text from the step; **suggestion_a/b**: derive two concrete answer options from the step context |
| `spawn_subagent` | **name**: `general` unless the task is read-only investigation (then `explore`); **taskDescription**: the full self-contained task description from the step |
| `start_subtask` | **title**: short label from the step; **message**: the detailed instructions from the step |
| `switch_mode` | **mode_id**: the mode slug/name from the step text, or `<target-mode-slug>` |
| `update_todo_list` | **todos**: the checklist content from the step, or a placeholder `[ ] <first item>` |
| `use_skill` | **skill_name**: the skill name from the step text, or `<skill-name>` |

### Phase 4 — Copy all other fields verbatim

Copy `slug`, `name`, `description`, `roleDefinition`, `whenToUse`, and `groups` character-for-character from the source. No paraphrasing or rewriting.

### Phase 5 — Preserve YAML scalar style

Keep the existing scalar style (`>` folded or `|` literal) as found in the source. Do not change it.

---

## 7 · LLM Output Format Rules

- Output **only** the converted YAML — no explanation, no commentary, no markdown fences wrapping the whole output.
- Must be valid YAML, directly copy-pasteable into `.bob/custom_modes.yaml`.
- Wrap all modes in the top-level `customModes:` array.
- Zone 2 step parameters use **dash** `-` sub-bullets, never asterisks `*`.
- Step body continuation indent: 3 extra spaces beyond the list-item level (9 spaces total from column 0).

---

## 8 · Complete Converted Example

A hand-written three-step reviewer mode after conversion to Kaoto canonical form:

```yaml
customModes:
  - slug: code-reviewer
    name: 🔍 Code Reviewer
    description: Reviews code changes and writes a report.
    roleDefinition: You are an expert code reviewer.
    whenToUse: Use when asked to review code or a PR.
    customInstructions: >
      system instructions:
      # <Zone 1 — injected by Kaoto on save, omitted from LLM output>


      1. **read_file**

         - path: <path to the file under review>

      2. Analyse the changes

         - Check for logic errors, security issues, and style violations.
         - Note any missing tests or documentation.

      3. **write_file**

         - path: review-output.md
         - content: <your detailed review>

      > Hard rules
      # <Zone 3 — injected by Kaoto on save, omitted from LLM output>
    groups:
      - read
      - edit
```

---

## 9 · UX Entry Points

| Entry point | Command | Scope | Condition |
|---|---|---|---|
| View title bar `$(wand)` button | `kaoto.bobModes.convertToKaoto` | QuickPick multi-select — user picks all or a subset | `kaoto.bobModesFileExists` is `true` |
| Right-click → _Convert to Kaoto Format_ (`navigation@2`) | `kaoto.bobModes.convertToKaotoSingle` | Single mode (by slug), no picker | `viewItem == bobMode` in the Bob Modes tree view |

Both commands are hidden from the Command Palette (`"when": "false"`) and only reachable from the entry points above.

### QuickPick behaviour (`convertToKaoto`)

- All modes are shown as checkboxes, **all pre-selected**.
- User can deselect individual modes to exclude them from conversion.
- If the user selects all modes → prompt says `ALL modes` and no merge instruction is needed.
- If the user selects a subset → prompt says `the modes with slugs: ...` and instructs Bob to copy every other mode verbatim.
- If the user cancels or de-selects everything → conversion is aborted with a warning.

### Right-click shortcut (`convertToKaotoSingle`)

- Skips the picker entirely.
- Passes the single item's `slug` directly to `convertModeToKaotoFormat`.
- Every other mode in the file is copied verbatim by Bob.

---

## 10 · Backup Behaviour

Before every conversion attempt the original file is copied to a timestamped sibling:

```
.bob/custom_modes.yaml
.bob/custom_modes.backup.2025-07-21_14-30-00.yaml
```

The backup is written **before** the prompt is sent to Bob. If the backup write fails the conversion continues with a warning (non-fatal).

## 11 · Write-back — Bob decides in chat

The LLM prompt instructs Bob to:

1. Perform the full conversion in memory (Phases 1–5).
2. Assemble the complete output file — **all modes** present (converted + verbatim copies).
3. Hold the result, then call `ask_followup_question`:
   - **suggestion_a** → `"Write to .bob/custom_modes.yaml (overwrites — backup already saved)"`
   - **suggestion_b** → `"Show here in chat so I can copy-paste it myself"`
4. If the user picks **write**: Bob calls `write_file` with the output path and full content. The tree view refreshes automatically because `BobModesProvider` watches the file.
5. If the user picks **show**: Bob prints the full YAML inside a ` ```yaml ` code block in chat for easy copy-paste.

This means **no result is ever silently discarded** — the user always sees and explicitly approves the write.

---

## 12 · YAML Folded-Scalar Rules for customInstructions

The `customInstructions` field uses the `>` (folded) scalar style. Key rules:

- A blank line between two content lines preserves a real `\n` in the value.
- Two consecutive blank lines produce a paragraph break (`\n\n`).
- The step-body continuation line (9 spaces) must be built programmatically (`' '.repeat(9)`) — editors strip trailing whitespace from otherwise-blank lines.
- All content lines sit at the **6-space base indent** (`      `) relative to the YAML key.
- Step body sub-bullets use 3 additional continuation spaces: **9 spaces total** from column 0.
