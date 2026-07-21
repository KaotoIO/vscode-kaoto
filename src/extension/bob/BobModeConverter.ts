/**
 * Copyright 2025 Red Hat, Inc. and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { existsSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import * as vscode from 'vscode';
import { KaotoOutputChannel } from '../KaotoOutputChannel';
import { sendToBobChat } from './BobChatUtils';
import { BOB_CUSTOM_INSTRUCTIONS_PREAMBLE, BOB_CUSTOM_INSTRUCTIONS_TRAILER } from './BobModeConstants';

// ─── Catalog + DSL reference ──────────────────────────────────────────────────

/** Indents every line of a multi-line string by `spaces` space characters. */
function indentBlock(text: string, spaces: number): string {
	const pad = ' '.repeat(spaces);
	return text
		.split('\n')
		.map((line) => (line.trim() === '' ? '' : pad + line))
		.join('\n');
}

/**
 * Builds the DSL reference + full catalog embedded in the LLM prompt.
 * The catalog is inlined verbatim so the LLM can reason about which tool
 * best fits each step and what parameter names/types are required.
 */
function buildDslReference(): string {
	const preambleBlock = indentBlock(BOB_CUSTOM_INSTRUCTIONS_PREAMBLE, 6);
	const trailerBlock = indentBlock(BOB_CUSTOM_INSTRUCTIONS_TRAILER, 6);

	return `\
## Kaoto Custom Mode — DSL Reference and Catalog

### Top-level YAML shape
\`\`\`yaml
customModes:
  - slug: <kebab-case-id>          # required, ^[a-z0-9-]+$
    name: <Human-readable name>    # required
    description: <short summary>   # optional
    roleDefinition: |              # required — persona / system prompt
      You are …
    whenToUse: |                   # optional — routing hint for orchestrator
      Use when …
    customInstructions: >          # Markdown; three zones (see below)
      …
    groups:                        # optional, subset of the values below
      - read | edit | execute | mcp | skill | todo | subtask | subagent | mode
\`\`\`

### customInstructions — three zones

**Zone 1 — Preamble:** the \`system instructions:\` paragraph that always comes
first. The Kaoto editor re-injects it automatically on save — **omit it from
your output**.

**Zone 2 — Steps:** numbered list items between preamble and trailer. This is
the content you are converting. Each step is either a *tool-invocation node*
or a *text-node* (generic step). See the catalog below to decide which.

**Zone 3 — Trailer:** the \`> Hard rules\` blockquote that always comes last.
The Kaoto editor re-injects it automatically on save — **omit it from your
output**.

---

### Step node syntax

**Tool-invocation node** — use when the step maps to one of the nine catalog
tools. The list-item title is the bold tool name; parameters are unordered
sub-bullets:
\`\`\`markdown
N. **tool_name**

   - requiredParam: value
   - optionalParam: value
\`\`\`

**Text node** — use for any step that does not map to a catalog tool. The
list-item title is the step label; the body is free prose or bullets:
\`\`\`markdown
N. Step label

   Body prose or bullet list describing what should happen.
   - detail one
   - detail two
\`\`\`

**Free-form block** — headings, paragraphs, or unordered lists that sit
*outside* any numbered step. Preserved as-is; become canvas text nodes:
\`\`\`markdown
## Section heading
Any prose here becomes a single free-form canvas node.
\`\`\`

---

### Catalog: available tools and component

Use this catalog to decide the node type for each step. Match the step's
*intent* to the tool *description*. When a tool fits, use its exact
\`name\` as the bold title and emit its parameters as sub-bullets using the
exact parameter names from its schema. Required params must always be present;
optional params only when the source provides a value or one can be
unambiguously inferred.

#### bobTool: read_file
Read the contents of a file from the workspace.
- **path** *(required, string)*: file path relative to workspace root
- **range** *(optional, string)*: line range, e.g. \`1-50\`

#### bobTool: write_file
Write content to a file (creates or overwrites).
- **path** *(required, string)*: file path relative to workspace root
- **content** *(required, string)*: full file content to write
- **line_count** *(optional, number)*: predicted line count

#### bobTool: execute_command
Run a CLI/shell command on the system.
- **command** *(required, string)*: bash command to execute
- **cwd** *(optional, string)*: working directory relative to workspace root
- **timeout_seconds** *(optional, number)*: max execution time (default 300)

#### bobTool: ask_followup_question
Ask the user a question with selectable answer suggestions.
- **question** *(required, string)*: the question to ask
- **suggestion_a** *(required, string)*: first answer option
- **suggestion_b** *(required, string)*: second answer option
- **suggestion_c** *(optional, string)*: third answer option
- **suggestion_d** *(optional, string)*: fourth answer option
- **allow_multiple** *(optional, boolean)*: allow selecting multiple answers

#### bobTool: spawn_subagent
Spawn an independent subagent for a focused, isolated task.
- **name** *(required, enum: \`explore\` | \`general\`)*: subagent type; use \`explore\` for read-only investigation, \`general\` for full work
- **taskDescription** *(required, string)*: self-contained instructions for the subagent
- **fork_context** *(optional, boolean)*: pass parent conversation history to subagent

#### bobTool: start_subtask
Create a new subtask with its own title, instructions, and optional mode.
- **title** *(required, string)*: short display title
- **message** *(required, string)*: detailed instructions for the subtask
- **mode** *(optional, string)*: mode ID to use (default: \`agent\`)
- **todos** *(optional, string)*: initial todo checklist in markdown

#### bobTool: switch_mode
Switch to a different Bob mode.
- **mode_id** *(required, string)*: slug of the target mode

#### bobTool: update_todo_list
Replace the current todo list with an updated checklist.
- **todos** *(required, string)*: full markdown checklist (\`[ ]\`, \`[-]\`, \`[x]\`)

#### bobTool: use_skill
Activate a named skill to load its instructions into context.
- **skill_name** *(required, string)*: name of the skill to activate

#### bobComponent: text-node
Generic free-text step — use for any step that does not fit a specific tool.
Renders as a plain numbered list item on the canvas.
- **content** *(required, string)*: the instruction text (supports markdown)
- **label** *(optional, string)*: short canvas label

---

### Complete example (after conversion)
\`\`\`yaml
customModes:
  - slug: code-reviewer
    name: 🔍 Code Reviewer
    description: Reviews code changes and writes a report.
    roleDefinition: You are an expert code reviewer.
    whenToUse: Use when asked to review code or a PR.
    customInstructions: >
${preambleBlock}


      1. **read_file**

         - path: <path to the file under review>

      2. Analyse the changes

         - Check for logic errors, security issues, and style violations.
         - Note any missing tests or documentation.

      3. **write_file**

         - path: review-output.md
         - content: <your detailed review>

${trailerBlock}
    groups:
      - read
      - edit
\`\`\`
`;
}

const KAOTO_DSL_REFERENCE = buildDslReference();

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Builds the full LLM prompt that asks Bob to:
 *  1. Convert the specified mode(s) to Kaoto DSL.
 *  2. Finish by calling `ask_followup_question` so the user can choose whether
 *     Bob writes the result back to disk (via `write_file`) or pastes it in chat.
 *
 * @param fullFileYaml - The complete raw YAML of custom_modes.yaml
 * @param slugs        - Slugs to convert. Undefined/empty = all modes.
 * @param outputPath   - Workspace-relative path for the write-back option,
 *                       e.g. `.bob/custom_modes.yaml`
 */
export function buildConvertPrompt(fullFileYaml: string, slugs: string[] | undefined, outputPath: string): string {
	const convertAll = !slugs || slugs.length === 0;
	const targetDescription = convertAll
		? 'ALL modes'
		: slugs.length === 1
			? `the mode with slug \`${slugs[0]}\``
			: `the modes with slugs: ${slugs.map((s) => `\`${s}\``).join(', ')}`;

	const mergeInstruction = convertAll
		? 'The result must contain all modes from the source, with every mode converted.'
		: `The result must contain ALL modes from the source. Convert only ${targetDescription}. Copy every other mode entry verbatim, character-for-character, without any changes.`;

	return `\
You are a **Kaoto custom-mode conversion assistant**. Your goal is to rewrite
the \`customInstructions\` field of ${targetDescription} as a proper Kaoto DSL
workflow so it can be opened in the Kaoto visual editor, displayed as canvas
nodes, and visually extended by the user.

**Think of this as rewriting the mode, not reformatting text.** Read the whole
mode first — understand its purpose, its role, and what it is meant to do.
Then express each step using the most appropriate catalog node so the resulting
canvas is a faithful, editable, visual representation of the original intent.

---

${KAOTO_DSL_REFERENCE}

---

## Conversion process

### Phase 1 — Understand the mode
Before writing any output, read the entire source mode and identify:
- The overall purpose and workflow the mode implements.
- Every distinct step or action it performs.
- Any concrete values mentioned: file paths, command strings, mode names,
  skill names, question text, todo items, subagent tasks, etc.

### Phase 2 — Strip preamble and trailer
Remove the \`system instructions:\` block (Zone 1) and the \`> Hard rules\`
blockquote (Zone 3). The Kaoto editor re-injects both on every save.
Your output for \`customInstructions\` contains only the steps (Zone 2).

### Phase 3 — Rewrite each step as a catalog node

For every step, choose the node type using this decision table:

| The step's intent | Node to use |
|---|---|
| Read, inspect, or view a file | **\`read_file\`** |
| Write, create, save, or output content to a file | **\`write_file\`** |
| Run a shell command, script, build, or test | **\`execute_command\`** |
| Ask the user a question or gather clarification | **\`ask_followup_question\`** |
| Delegate a self-contained task to an independent subagent | **\`spawn_subagent\`** |
| Create a new subtask or sub-workflow | **\`start_subtask\`** |
| Hand off to a different Bob mode | **\`switch_mode\`** |
| Record, update, or track a todo / checklist | **\`update_todo_list\`** |
| Load a named skill into context | **\`use_skill\`** |
| Anything else | **\`text-node\`** (generic step) |

#### Tool-invocation node rules

Emit **every required parameter** — always, no exceptions. Use the exact
parameter name from the catalog schema. Derive the value from the source:

- **Explicit value in source** → copy it verbatim as the parameter value.
- **Implied by context** (e.g. a path mentioned earlier in the step body,
  a mode name in the text, a command visible in the prose) → extract and use it.
- **Genuinely absent** → use a terse \`<descriptive-placeholder>\` that tells the
  user what value is needed (e.g. \`<path to input file>\`, \`<target mode slug>\`).

Emit an **optional parameter only** when the source explicitly provides its
value. Never invent optional param values.

Parameter-specific guidance for each tool:

| Tool | Required params — how to extract the value |
|---|---|
| \`read_file\` | **path**: extract file path from step text; placeholder \`<file path>\` if absent |
| \`write_file\` | **path**: output file path from step text; **content**: what the step says to write, or \`<generated content>\` |
| \`execute_command\` | **command**: the exact command string from the step, or \`<command to run>\` |
| \`ask_followup_question\` | **question**: the question text from the step; **suggestion_a/b**: derive two concrete answer options from the step context |
| \`spawn_subagent\` | **name**: \`general\` unless the task is read-only investigation (then \`explore\`); **taskDescription**: the full self-contained task description from the step |
| \`start_subtask\` | **title**: short label from the step; **message**: the detailed instructions from the step |
| \`switch_mode\` | **mode_id**: the mode slug/name from the step text, or \`<target-mode-slug>\` |
| \`update_todo_list\` | **todos**: the checklist content from the step, or a placeholder checklist \`[ ] <first item>\` |
| \`use_skill\` | **skill_name**: the skill name from the step text, or \`<skill-name>\` |

Syntax:
\`\`\`markdown
N. **tool_name**

   - requiredParam: value
   - anotherRequired: value
\`\`\`

#### Text node rules

When a step does not map to any catalog tool, emit a plain numbered list item.
Preserve the original wording of the title and body **exactly** — do not
paraphrase, shorten, or rephrase even a single word:
\`\`\`markdown
N. Original step title

   Original body prose or bullets — copied verbatim.
\`\`\`

#### Free-form block rules

Any heading, paragraph, or unordered list outside a numbered step is a
free-form block. Keep it in the same relative position, unchanged.

### Phase 4 — Write all other fields verbatim
Copy \`slug\`, \`name\`, \`description\`, \`roleDefinition\`, \`whenToUse\`, and
\`groups\` character-for-character from the source. Do not paraphrase, shorten,
reword, or normalise spelling.

### Phase 5 — YAML scalar style
Keep the existing scalar style (\`>\` folded or \`|\` literal) that is already
present in the source. Do not change it.

### Phase 6 — Assemble the full output file
${mergeInstruction}

Hold the complete converted YAML in memory — do **not** print it yet.

### Phase 7 — Ask the user what to do with the result
Call \`ask_followup_question\` with:
- **question**: "Conversion complete. What would you like to do with the result?"
- **suggestion_a**: "Write to \`${outputPath}\` (overwrites the file — backup already saved)"
- **suggestion_b**: "Show here in chat so I can copy-paste it myself"

Then act on the answer:
- If the user chooses **suggestion_a**: call \`write_file\` with path \`${outputPath}\`
  and the complete converted YAML as content. Confirm with a short message.
- If the user chooses **suggestion_b**: print the complete converted YAML inside
  a single \`\`\`yaml … \`\`\` code block so it is easy to copy.

---

## Source file

\`\`\`yaml
${fullFileYaml}
\`\`\`

---

Rewrite ${targetDescription} as a Kaoto DSL workflow now.
- Understand the mode's full intent before writing anything.
- Express every step using the best-fit catalog node with all required
  parameters correctly populated from the source.
- Strip the preamble and trailer — Kaoto restores them on save.
- Preserve every word of user-written text that is not a parameter value.
- Finish by calling \`ask_followup_question\` to let the user choose write vs. show.
`;
}

// ─── Command handler ──────────────────────────────────────────────────────────

/** Context for the convert command. */
export interface ConvertCommandArgs {
	/**
	 * Slugs of the modes to convert. When undefined or empty, all modes are
	 * converted. When one or more slugs are provided (from a tree-item right-click
	 * or QuickPick selection) only those modes are converted; every other mode is
	 * copied verbatim into the output.
	 */
	slugs?: string[];
	/** URI of the custom_modes.yaml file to read. */
	fileUri?: vscode.Uri;
}

/**
 * Core command handler for `kaoto.bobModes.convertToKaoto`.
 *
 * UX flow:
 *  1. Resolve the custom_modes.yaml file path.
 *  2. Validate + read the YAML content.
 *  3. Write a timestamped backup: `custom_modes.backup.<YYYY-MM-DD_HH-MM-SS>.yaml`.
 *  4. Build the LLM conversion prompt and send it to Bob Chat.
 *     Bob converts, then asks the user in chat whether to write the file or
 *     display the YAML for manual copy-paste.
 */
export async function convertModeToKaotoFormat(args?: ConvertCommandArgs): Promise<void> {
	// ── 1. Resolve file path ──────────────────────────────────────────────────
	let fileUri = args?.fileUri;
	if (!fileUri) {
		const wsFolders = vscode.workspace.workspaceFolders;
		if (!wsFolders?.length) {
			void vscode.window.showWarningMessage('No workspace folder is open. Cannot locate custom_modes.yaml.');
			return;
		}
		fileUri = vscode.Uri.joinPath(wsFolders[0].uri, '.bob', 'custom_modes.yaml');
	}

	if (!existsSync(fileUri.fsPath)) {
		void vscode.window.showWarningMessage(`custom_modes.yaml not found at ${fileUri.fsPath}`);
		return;
	}

	// ── 2. Read YAML content ──────────────────────────────────────────────────
	let rawYaml: string;
	try {
		rawYaml = readFileSync(fileUri.fsPath, 'utf8');
	} catch (err) {
		KaotoOutputChannel.logError('[BobModeConverter] Failed to read custom_modes.yaml', err);
		void vscode.window.showErrorMessage(`Failed to read ${fileUri.fsPath}`);
		return;
	}

	// Validate that the file contains at least the expected root key
	try {
		const parsed = parseYaml(rawYaml) as { customModes?: unknown } | null;
		if (!Array.isArray(parsed?.customModes)) {
			void vscode.window.showWarningMessage('The file does not appear to contain a valid customModes array. Nothing to convert.');
			return;
		}
	} catch {
		void vscode.window.showWarningMessage('custom_modes.yaml is not valid YAML. Please fix syntax errors first.');
		return;
	}

	// ── 3. Always save a timestamped backup of the original file ─────────────
	const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
	const backupUri = vscode.Uri.file(fileUri.fsPath.replace(/\.yaml$/, `.backup.${ts}.yaml`));
	try {
		await vscode.workspace.fs.copy(fileUri, backupUri, { overwrite: true });
		void vscode.window.showInformationMessage(`Backup saved to ${backupUri.fsPath}`);
	} catch (err) {
		KaotoOutputChannel.logError('[BobModeConverter] Failed to create backup', err);
		void vscode.window.showWarningMessage(`Could not save backup (${(err as Error).message}). Continuing with conversion anyway.`);
	}

	// ── 4. Derive workspace-relative output path for the write-back option ────
	const wsFolders = vscode.workspace.workspaceFolders;
	const wsRoot = wsFolders?.[0]?.uri.fsPath ?? '';
	const outputPath = wsRoot && fileUri.fsPath.startsWith(wsRoot) ? fileUri.fsPath.slice(wsRoot.length).replace(/^[\\/]/, '') : fileUri.fsPath;

	// ── 5. Build prompt and send to Bob Chat ──────────────────────────────────
	const prompt = buildConvertPrompt(rawYaml, args?.slugs, outputPath);
	await sendToBobChat(prompt);
}

// ─── Helper: read all slugs from the file ────────────────────────────────────

/**
 * Parses custom_modes.yaml and returns `{ slug, name }` entries in file order.
 * Used by the QuickPick multi-select in BobModesRegistrar.
 * Returns an empty array on any parse error.
 */
export function readModeSlugs(filePath: string): Array<{ slug: string; name: string }> {
	try {
		const raw = readFileSync(filePath, 'utf8');
		const parsed = parseYaml(raw) as { customModes?: unknown[] } | null;
		const modes = parsed?.customModes;
		if (!Array.isArray(modes)) {
			return [];
		}
		const result: Array<{ slug: string; name: string }> = [];
		for (const entry of modes) {
			if (!entry || typeof entry !== 'object') {
				continue;
			}
			const e = entry as Record<string, unknown>;
			const slug = typeof e['slug'] === 'string' ? e['slug'].trim() : undefined;
			if (!slug) {
				continue;
			}
			const name = typeof e['name'] === 'string' ? e['name'].trim() : slug;
			result.push({ slug, name });
		}
		return result;
	} catch {
		return [];
	}
}
