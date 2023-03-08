import { KaotoEditorFactory } from "@kaoto/kaoto-ui/dist/lib/kogito-integration";
import * as EditorEnvelope from "@kie-tools-core/editor/dist/envelope";
import { kaotoBackendPort } from "./../extension/extension";

declare const acquireVsCodeApi: any;

EditorEnvelope.init({
  container: document.getElementById("envelope-app")!,
  bus: acquireVsCodeApi(),
  editorFactory: new KaotoEditorFactory(`http://localhost:${kaotoBackendPort}`),
});
