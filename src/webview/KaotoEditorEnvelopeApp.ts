import { KaotoEditorFactory } from '@kaoto-next/ui';
import { Editor, EditorFactory, KogitoEditorChannelApi } from '@kie-tools-core/editor/dist/api';
import * as EditorEnvelope from '@kie-tools-core/editor/dist/envelope';
declare const acquireVsCodeApi: any;

// camel catalog component --json --camel-version=3.18.3.redhat-00024

EditorEnvelope.init({
  container: document.getElementById('envelope-app')!,
  bus: acquireVsCodeApi(),
  editorFactory: new KaotoEditorFactory() as unknown as EditorFactory<Editor, KogitoEditorChannelApi>,
});
