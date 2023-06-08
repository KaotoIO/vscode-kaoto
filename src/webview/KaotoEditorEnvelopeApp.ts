import { KaotoEditorFactory } from '@kaoto/kaoto-ui/dist/lib/kogito-integration';
import { Editor, EditorFactory, KogitoEditorChannelApi } from '@kie-tools-core/editor/dist/api';
import * as EditorEnvelope from '@kie-tools-core/editor/dist/envelope';
declare const acquireVsCodeApi: any;

EditorEnvelope.init({
  container: document.getElementById('envelope-app')!,
  bus: acquireVsCodeApi(),
  editorFactory: new KaotoEditorFactory() as unknown as EditorFactory<Editor, KogitoEditorChannelApi>,
});
