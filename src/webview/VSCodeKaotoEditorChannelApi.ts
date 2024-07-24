import { KaotoEditorChannelApi } from '@kaoto/kaoto';
import { ISettingsModel, NodeLabelType, SettingsModel } from '@kaoto/kaoto/models';
import { DefaultVsCodeKieEditorChannelApiImpl } from '@kie-tools-core/vscode-extension/dist/DefaultVsCodeKieEditorChannelApiImpl';
import * as vscode from 'vscode';

export class VSCodeKaotoEditorChannelApi extends DefaultVsCodeKieEditorChannelApiImpl implements KaotoEditorChannelApi {
  async getCatalogURL(): Promise<string | undefined> {
    return await vscode.workspace.getConfiguration('kaoto').get('catalog.url');
  }

  async getVSCodeKaotoSettings(): Promise<ISettingsModel> {
    const settingsModel: ISettingsModel = {
      catalogUrl: vscode.workspace.getConfiguration('kaoto').get<string | null>('catalog.url') ?? '',
      nodeLabel: NodeLabelType.Description,
    };

    return new SettingsModel(settingsModel);
  }
}
