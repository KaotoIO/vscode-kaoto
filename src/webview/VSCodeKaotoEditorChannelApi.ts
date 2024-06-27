import { DefaultVsCodeKieEditorChannelApiImpl } from '@kie-tools-core/vscode-extension/dist/DefaultVsCodeKieEditorChannelApiImpl';
import * as vscode from 'vscode';

export class VSCodeKaotoEditorChannelApi extends DefaultVsCodeKieEditorChannelApiImpl {
    async getCatalogURL(): Promise<string | undefined> {
        return await vscode.workspace.getConfiguration('kaoto').get('catalog.url');
    }
}
