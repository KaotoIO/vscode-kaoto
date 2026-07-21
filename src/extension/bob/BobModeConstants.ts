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

/**
 * Zone 1 — preamble text that the Kaoto editor re-injects at the top of every
 * `customInstructions` value on save.
 *
 * Stored without YAML indentation so callers can re-indent with `indentBlock`.
 * The Kaoto editor strips this block when parsing and re-adds it on serialize,
 * so LLM conversion output must NOT include it.
 */
export const BOB_CUSTOM_INSTRUCTIONS_PREAMBLE = `\
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
issued as real tool invocations before moving to the next step.`;

/**
 * Zone 3 — trailer blockquote that the Kaoto editor re-injects at the bottom
 * of every `customInstructions` value on save.
 *
 * Stored without YAML indentation so callers can re-indent with `indentBlock`.
 * The Kaoto editor strips this block when parsing and re-adds it on serialize,
 * so LLM conversion output must NOT include it.
 */
export const BOB_CUSTOM_INSTRUCTIONS_TRAILER = `\
> Hard rules

> - Do not invent content not present in the input.

> - Follow the output format specified in the final step exactly.`;
