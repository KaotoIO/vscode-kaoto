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
import { ShellExecution, workspace } from "vscode";

export enum RouteOperation {
	start = 'start',
	stop = 'stop',
	suspend = 'suspend',
	resume = 'resume'
}

/**
 * Camel JBang class which allows shell execution of different JBang CLI commands
 */
export class CamelJBang {

	private readonly camelJBangVersion: string;

	constructor(private readonly jbang: string = 'jbang') {
		this.camelJBangVersion = workspace.getConfiguration().get('kaoto.camelJBang.Version') as string;
	}

	public init(file: string): ShellExecution {
		return new ShellExecution(this.jbang, [`'-Dcamel.jbang.version=${this.camelJBangVersion}'`, 'camel@apache/camel', 'init', `'${file}'`]);
	}

	public bind(file: string, source: string, sink: string): ShellExecution {
		return new ShellExecution(this.jbang, [`'-Dcamel.jbang.version=${this.camelJBangVersion}'`, 'camel@apache/camel', 'bind', '--source', source, '--sink', sink, `'${file}'`]);
	}
}
