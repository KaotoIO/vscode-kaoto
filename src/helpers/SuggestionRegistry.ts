/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License", destination); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export type Suggestion = {
	value: string;
	description?: string;
	group?: string;
};

export type SuggestionContext = {
	propertyName: string;
	inputValue: string | number;
	cursorPosition?: number | null;
};

export type SuggestionProviderFunction = (word: string, context: SuggestionContext) => Suggestion[] | Promise<Suggestion[]>;

const suggestionRegistry = new Map<string, SuggestionProviderFunction>();

/**
 * Registers a new suggestion provider for a given topic
 */
export function registerSuggestionProvider(topic: string, providerFn: SuggestionProviderFunction): void {
	suggestionRegistry.set(topic, providerFn);
}

/**
 * Retrieves suggestions from the provider registered for the given topic
 * @param topic The topic for which suggestions are being requested (e.g., "env", "properties", "kubernetes", "beans", etc.)
 * @param word The current word or input value for which suggestions are being requested
 * @param context Additional context for the suggestions, such as the property name and current input value.
 * @returns A promise that resolves to an array of suggestions, each containing a value, optional description, and optional group.
 */
export async function getSuggestions(topic: string, word: string, context: SuggestionContext): Promise<Suggestion[]> {
	const suggestionProvider = suggestionRegistry.get(topic);
	if (!suggestionProvider) {
		return [];
	}
	const result = suggestionProvider(word ?? '', context);
	return Promise.resolve(result);
}

const provideEnvSuggestions: SuggestionProviderFunction = (word, _context) => {
	const lowerWord = word.toLowerCase();
	return Object.keys(process.env)
		.map((envVar) => {
			if (envVar.startsWith(word)) {
				return { envVar, rank: 0 }; // Exact case-sensitive prefix match
			}
			if (envVar.toLowerCase().startsWith(lowerWord)) {
				return { envVar, rank: 1 }; // Case-insensitive prefix match
			}
			if (envVar.includes(word)) {
				return { envVar, rank: 2 }; // Case-sensitive substring match
			}
			if (envVar.toLowerCase().includes(lowerWord)) {
				return { envVar, rank: 3 }; // Case-insensitive substring match
			}
			return null;
		})
		.filter((x): x is { envVar: string; rank: number } => x !== null)
		.sort((a, b) => a.rank - b.rank || a.envVar.localeCompare(b.envVar))
		.map(({ envVar }) => ({
			value: envVar,
		}));
};

/**
 * Register 'env' suggestion provider
 */
registerSuggestionProvider('env', provideEnvSuggestions);
