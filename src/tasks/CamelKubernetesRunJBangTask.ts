/**
 * Copyright 2025 Red Hat, Inc. and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ShellExecution, TaskScope, window, workspace } from 'vscode';
import { CamelJBangTask } from './CamelJBangTask';
import { basename, dirname } from 'path';
import { CamelKubernetesJBang } from '../helpers/CamelKubernetesJBang';

export class CamelKubernetesRunJBangTask extends CamelJBangTask {
	private constructor(shellExecution: ShellExecution, filePath: string) {
		super(TaskScope.Workspace, `Deploying - ${basename(filePath)}`, shellExecution);
	}

	static async create(filePath: string): Promise<CamelKubernetesRunJBangTask> {
		let clusterType = workspace.getConfiguration().get('kaoto.deploy.clusterType') as string;

		if (clusterType === 'Ask') {
			const clusterTypePick = await window.showQuickPick(['Kubernetes', 'OpenShift', 'Knative', 'Minikube', 'Kind'], {
				placeHolder: 'Select the cluster type',
			});

			if (clusterTypePick === undefined) {
				throw new Error('Deployment cancelled');
			}
			clusterType = clusterTypePick;
		}

		const shellExecution = await new CamelKubernetesJBang().run(filePath, dirname(filePath), undefined, clusterType);
		return new CamelKubernetesRunJBangTask(shellExecution, filePath);
	}
}
