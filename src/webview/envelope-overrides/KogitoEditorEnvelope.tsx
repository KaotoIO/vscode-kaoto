/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * This class is a copy of https://github.com/apache/incubator-kie-tools/blob/main/packages/editor/src/envelope/KogitoEditorEnvelope.tsx
 * meant to override how React apps are bootstrapped.
 */
import {
	Editor,
	KogitoEditorChannelApi,
	KogitoEditorEnvelopeApi,
	KogitoEditorEnvelopeContext,
	KogitoEditorEnvelopeContextType,
} from '@kie-tools-core/editor/dist/api';
import { EditorEnvelopeViewApi } from '@kie-tools-core/editor/dist/envelope';
import { EditorEnvelopeView } from '@kie-tools-core/editor/dist/envelope/EditorEnvelopeView';
import { EditorEnvelopeI18nContext, editorEnvelopeI18nDefaults, editorEnvelopeI18nDictionaries } from '@kie-tools-core/editor/dist/envelope/i18n';
import { Envelope, EnvelopeApiFactory } from '@kie-tools-core/envelope';
import { ApiDefinition } from '@kie-tools-core/envelope-bus/dist/api';
import { I18nService } from '@kie-tools-core/i18n/dist/envelope';
import { I18nDictionariesProvider } from '@kie-tools-core/i18n/dist/react-components';
import { KeyboardShortcutsService } from '@kie-tools-core/keyboard-shortcuts/dist/envelope/KeyboardShortcutsService';
import { getOperatingSystem } from '@kie-tools-core/operating-system';
import { createRef } from 'react';

import { createRoot } from 'react-dom/client';

export class KogitoEditorEnvelope<
	E extends Editor,
	EnvelopeApi extends KogitoEditorEnvelopeApi & ApiDefinition<EnvelopeApi>,
	ChannelApi extends KogitoEditorChannelApi & ApiDefinition<ChannelApi>,
> {
	constructor(
		private readonly kogitoEditorEnvelopeApiFactory: EnvelopeApiFactory<
			EnvelopeApi,
			ChannelApi,
			EditorEnvelopeViewApi<E>,
			KogitoEditorEnvelopeContextType<ChannelApi>
		>,
		private readonly keyboardShortcutsService: KeyboardShortcutsService,
		private readonly i18nService: I18nService,
		private readonly envelope: Envelope<EnvelopeApi, ChannelApi, EditorEnvelopeViewApi<E>, KogitoEditorEnvelopeContextType<ChannelApi>>,
		private readonly context: KogitoEditorEnvelopeContextType<ChannelApi> = {
			channelApi: envelope.channelApi,
			operatingSystem: getOperatingSystem(),
			services: {
				keyboardShortcuts: keyboardShortcutsService,
				i18n: i18nService,
			},
			supportedThemes: [],
		},
	) {}

	public start(container: HTMLElement) {
		return this.envelope.start(() => this.renderView(container), this.context, this.kogitoEditorEnvelopeApiFactory);
	}

	private renderView(container: HTMLElement) {
		const editorEnvelopeViewRef = createRef<EditorEnvelopeViewApi<E>>();

		const app = (
			<KogitoEditorEnvelopeContext.Provider value={this.context}>
				<I18nDictionariesProvider
					defaults={editorEnvelopeI18nDefaults}
					dictionaries={editorEnvelopeI18nDictionaries}
					ctx={EditorEnvelopeI18nContext}
					initialLocale={navigator.language}
				>
					<EditorEnvelopeI18nContext.Consumer>
						{({ setLocale }) => (
							<EditorEnvelopeView
								ref={editorEnvelopeViewRef}
								setLocale={setLocale}
								showKeyBindingsOverlay={this.keyboardShortcutsService.isEnabled()}
							/>
						)}
					</EditorEnvelopeI18nContext.Consumer>
				</I18nDictionariesProvider>
			</KogitoEditorEnvelopeContext.Provider>
		);

		return new Promise<() => EditorEnvelopeViewApi<E>>((res) => {
			setTimeout(() => {
				const root = createRoot(container);
				root.render(app);
			}, 0);

			setTimeout(() => {
				res(() => editorEnvelopeViewRef.current!);
			}, 0);
		});
	}
}
