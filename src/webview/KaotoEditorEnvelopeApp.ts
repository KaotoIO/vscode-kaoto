import { NoOpKeyboardShortcutsService } from '@kie-tools-core/keyboard-shortcuts/dist/envelope';
import * as EditorEnvelope from '@kie-tools-core/editor/dist/envelope';
import { KaotoEditorFactory } from '@kaoto/kaoto';

declare const acquireVsCodeApi: any;

EditorEnvelope.init({
	container: document.getElementById('envelope-app')!,
	bus: acquireVsCodeApi(),
	editorFactory: new KaotoEditorFactory(),
	keyboardShortcutsService: new NoOpKeyboardShortcutsService(),
});
