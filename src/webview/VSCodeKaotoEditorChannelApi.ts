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
import { logInKaotoOutputChannel } from './../KaotoOutputChannelManager';

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

  /**
   * Provide metadata stored in the nearest .kaoto file found
   * If none found, undefined is returned
   */
  async getMetadata<T>(key: string): Promise<T | undefined> {
    const kaotoMetadatafile: vscode.Uri | undefined = await this.findKaotoMetadataFile(this.currentEditedDocument.uri);
    if (kaotoMetadatafile !== undefined) {
      try {
        const kaotoMetadataFileContent = new TextDecoder().decode(await vscode.workspace.fs.readFile(kaotoMetadatafile));
        return JSON.parse(kaotoMetadataFileContent)[key]; // in case the key i snot present, should we look to other potential .kaoto files that could contain the information?
      } catch (ex){
        logInKaotoOutputChannel(`Error when trying to get Metadata for key: ${key}`, ex);
        // Should we look to other potential .kaoto files and ignore one which is invalid?
        return undefined; // or should we throw a specific exception?
      }
    }
    return undefined;
  }

  /**
   * Store metadata in the nearest .kaoto file found.
   * If none found, create the file at workspace root if available, otherwise to the side of the Camel route
   */
  async setMetadata<T>(key: string, value: T | undefined): Promise<void> {
    let kaotoMetadatafile: vscode.Uri | undefined = await this.findKaotoMetadataFile(this.currentEditedDocument.uri);
    let kaotoMetadataFileContent;
    if (kaotoMetadatafile === undefined) {
      kaotoMetadataFileContent = "{}";
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(this.currentEditedDocument.uri);
      if (workspaceFolder !== undefined) {
        kaotoMetadatafile = vscode.Uri.file(path.join(workspaceFolder?.uri.fsPath, '.kaoto'));
      } else {
        const parentFolder = path.basename(path.dirname(this.currentEditedDocument.uri.fsPath));
        kaotoMetadatafile = vscode.Uri.file(path.join(parentFolder, '.kaoto'));
      }
    } else {
      kaotoMetadataFileContent = new TextDecoder().decode(await vscode.workspace.fs.readFile(kaotoMetadatafile));
    }
    const jsonContent = JSON.parse(kaotoMetadataFileContent);
    if (value !== undefined && value !== null) {
      jsonContent[key] = value;
    } else {
      delete jsonContent[key];
    }
    await vscode.workspace.fs.writeFile(kaotoMetadatafile, new TextEncoder().encode(JSON.stringify(jsonContent, null, '\t')));
  }

  private async findKaotoMetadataFile(fileUri: vscode.Uri): Promise<vscode.Uri | undefined> {
    const parentFolder = path.dirname(fileUri.fsPath);
    if (parentFolder === fileUri.fsPath || parentFolder === "" || parentFolder === undefined) {
      return undefined;
    }
    try {
      const kaotoMetadataFileCandidate = vscode.Uri.file(path.join(parentFolder, '.kaoto'));
      await vscode.workspace.fs.stat(kaotoMetadataFileCandidate);
      return kaotoMetadataFileCandidate;
    } catch {
      return this.findKaotoMetadataFile(vscode.Uri.file(parentFolder));
    }
  }

  async getResourceContent(relativePath: string): Promise<string | undefined> {
    try {
      const targetFile = path.resolve(path.dirname(this.currentEditedDocument.uri.fsPath), relativePath);
      return new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.file(targetFile)));
    } catch (ex) {
      const errorMessage= `Cannot retrieve content of ${relativePath} relatively to ${this.currentEditedDocument.uri.fsPath}`;
      vscode.window.showErrorMessage(errorMessage);
      logInKaotoOutputChannel(errorMessage, ex);
      return undefined;
    }
  }

  async saveResourceContent(relativePath: string, content: string): Promise<void> {
    try {
      const targetFile = path.resolve(path.dirname(this.currentEditedDocument.uri.fsPath), relativePath);
      await vscode.workspace.fs.writeFile(vscode.Uri.file(targetFile), new TextEncoder().encode(content));
    } catch (ex) {
      const errorMessage = `Cannot write content of ${relativePath} relatively to ${this.currentEditedDocument.uri.fsPath}`;
      vscode.window.showErrorMessage(errorMessage);
      logInKaotoOutputChannel(errorMessage, ex);
      return undefined;
    }
  }

  async deleteResource(relativePath: string): Promise<boolean> {
    try {
      const targetFile = path.resolve(path.dirname(this.currentEditedDocument.uri.fsPath), relativePath);
      await vscode.workspace.fs.delete(vscode.Uri.file(targetFile));
      return true;
    } catch (ex) {
      const errorMessage = `Cannot delete ${relativePath} relatively to ${this.currentEditedDocument.uri.fsPath}`;
      vscode.window.showErrorMessage(errorMessage);
      logInKaotoOutputChannel(errorMessage, ex);
      return false;
    }
  }

  async askUserForFileSelection(include: string, exclude?: string, options?: Record<string, unknown>): Promise<string[] | string | undefined> {
    try {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(this.currentEditedDocument.uri);
      if (!workspaceFolder) {
        vscode.window.showErrorMessage(`No associated workspace folder was found. Setup the workspace and place the file under the same workspace folder with ${this.currentEditedDocument.uri.fsPath}`);
        return;
      }
      const includePattern = new vscode.RelativePattern(workspaceFolder, include);
      const files = await vscode.workspace.findFiles(includePattern, exclude);
      if (files.length === 0) {
        vscode.window.showErrorMessage(`No candidate file was found in the workspace folder. Place the file under the same workspace folder with  ${this.currentEditedDocument.uri.fsPath}`);
        return;
      }
      return await vscode.window.showQuickPick(files.map((f) => {
        return path.relative(path.dirname(this.currentEditedDocument.uri.fsPath), f.path);
      }), options as vscode.QuickPickOptions);
    } catch (ex) {
      const errorMessage = `Cannot get a user selection: ${ex.message}`;
      vscode.window.showErrorMessage(errorMessage);
      logInKaotoOutputChannel(errorMessage, ex);
      return undefined;
    }
  }
}
