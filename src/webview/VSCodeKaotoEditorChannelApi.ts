import { KaotoEditorChannelApi } from '@kaoto/kaoto';
import { ISettingsModel, NodeLabelType, SettingsModel } from '@kaoto/kaoto/models';
import { BackendProxy } from '@kie-tools-core/backend/dist/api';
import { NotificationsChannelApi } from "@kie-tools-core/notifications/dist/api";
import { ResourceContentService, WorkspaceChannelApi } from "@kie-tools-core/workspace/dist/api";
import { I18n } from '@kie-tools-core/i18n/dist/core';
import { DefaultVsCodeKieEditorChannelApiImpl } from '@kie-tools-core/vscode-extension/dist/DefaultVsCodeKieEditorChannelApiImpl';
import { VsCodeI18n } from '@kie-tools-core/vscode-extension/dist/i18n';
import { VsCodeKieEditorController } from '@kie-tools-core/vscode-extension/dist/VsCodeKieEditorController';
import { JavaCodeCompletionApi } from '@kie-tools-core/vscode-java-code-completion/dist/api';
import * as vscode from 'vscode';
import { VsCodeKieEditorCustomDocument } from '@kie-tools-core/vscode-extension/dist/VsCodeKieEditorCustomDocument';
import * as path from 'path';

export class VSCodeKaotoEditorChannelApi extends DefaultVsCodeKieEditorChannelApiImpl implements KaotoEditorChannelApi {

  private readonly currentEditedDocument: vscode.TextDocument | VsCodeKieEditorCustomDocument;

  constructor(
    editor: VsCodeKieEditorController,
    resourceContentService: ResourceContentService,
    workspaceApi: WorkspaceChannelApi,
    backendProxy: BackendProxy,
    notificationsApi: NotificationsChannelApi,
    javaCodeCompletionApi: JavaCodeCompletionApi,
    viewType: string,
    i18n: I18n<VsCodeI18n>
  ) {
    super(editor, resourceContentService, workspaceApi, backendProxy, notificationsApi, javaCodeCompletionApi, viewType, i18n);
    this.currentEditedDocument = editor.document.document;
  }

  async getCatalogURL(): Promise<string | undefined> {
    return await vscode.workspace.getConfiguration('kaoto').get('catalog.url');
  }

  async getVSCodeKaotoSettings(): Promise<ISettingsModel> {
    const catalogUrl = await vscode.workspace.getConfiguration('kaoto').get<Promise<string | null>>('catalog.url');
    const nodeLabel = await vscode.workspace.getConfiguration('kaoto').get<Promise<NodeLabelType | null>>('nodeLabel');

    const settingsModel: ISettingsModel = {
      catalogUrl: catalogUrl ?? '',
      nodeLabel: nodeLabel ?? NodeLabelType.Description,
    };

    return new SettingsModel(settingsModel);
  }

  async getMetadata<T>(key: string): Promise<T | undefined> {
    vscode.window.showErrorMessage(`getMetadata Not implemented. It was called with ${key}`);
    return undefined;
  }

  async setMetadata<T>(key: string, value: T | undefined): Promise<void> {
    vscode.window.showErrorMessage(`setMetadata Not implemented. It was called with ${key} and ${value}`);
  }

  async getResourceContent(relativePath: string): Promise<string | undefined> {
    vscode.window.showErrorMessage(`getResourceContent Not implemented. It was called with ${relativePath}`);
    return undefined;
  }

  async saveResourceContent(relativePath: string, content: string): Promise<void> {
    vscode.window.showErrorMessage(`saveResourceContent Not implemented. It was called with ${relativePath} and ${content}`);
  }
}
