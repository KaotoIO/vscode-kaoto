import { KaotoEditorFactory } from '@kaoto/kaoto';
import * as EditorEnvelope from '@kie-tools-core/editor/dist/envelope';
import { NoOpKeyboardShortcutsService } from '@kie-tools-core/keyboard-shortcuts/dist/envelope';

declare const acquireVsCodeApi: any;

EditorEnvelope.init({
  container: document.getElementById('envelope-app')!,
  bus: acquireVsCodeApi(),
  editorFactory: new KaotoEditorFactory(),
  keyboardShortcutsService: new NoOpKeyboardShortcutsService(),
});
