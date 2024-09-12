import { KaotoEditorChannelApi } from '@kaoto/kaoto';
import { ISettingsModel, NodeLabelType, SettingsModel } from '@kaoto/kaoto/models';
import { DefaultVsCodeKieEditorChannelApiImpl } from '@kie-tools-core/vscode-extension/dist/DefaultVsCodeKieEditorChannelApiImpl';
import * as vscode from 'vscode';

export class VSCodeKaotoEditorChannelApi extends DefaultVsCodeKieEditorChannelApiImpl implements KaotoEditorChannelApi {
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

  async getFilePreferences<T>(key: string): Promise<T> {
    vscode.window.showInformationMessage('Method not implemented.');
    return {} as T;
  }

  async setFilePreferences(key: string): Promise<void> {
    vscode.window.showInformationMessage('Method not implemented.');
  }

}
