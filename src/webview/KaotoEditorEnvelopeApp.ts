import { Editor, EditorFactory } from '@kie-tools-core/editor/dist/api';
import { NoOpKeyboardShortcutsService } from "@kie-tools-core/keyboard-shortcuts/dist/envelope";
import * as EditorEnvelope from '@kie-tools-core/editor/dist/envelope';
import { KaotoEditorChannelApi, KaotoEditorFactory } from '@kaoto/kaoto';

declare const acquireVsCodeApi: any;

EditorEnvelope.init({
  container: document.getElementById('envelope-app')!,
  bus: acquireVsCodeApi(),
  editorFactory: new KaotoEditorFactory() as unknown as EditorFactory<Editor, KaotoEditorChannelApi> ,
  keyboardShortcutsService: new NoOpKeyboardShortcutsService()
});
