/**
 * Copyright 2024 Red Hat, Inc. and/or its affiliates.
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

// This class is used for automatic port allocation for Camel Run commands using --console parameter
export class PortManager {
    private usedPorts: Set<number> = new Set();
    private readonly minPort: number;
    private readonly maxPort: number;

    constructor(minPort: number, maxPort: number) {
        this.minPort = minPort;
        this.maxPort = maxPort;
    }

    allocatePort(): number | undefined {
        for (let port = this.minPort; port <= this.maxPort; port++) {
            if (!this.usedPorts.has(port)) {
                this.usedPorts.add(port);
                return port;
            }
        }
        console.error('No more free ports available.');
        return undefined;
    }

    freePort(port: number): void {
        this.usedPorts.delete(port);
    }

    freeAllPorts(): void {
        this.usedPorts.clear();
    }

    getUsedPorts(): number[] {
        console.log('PortManager ~ usedPorts:', this.usedPorts);
        return Array.from(this.usedPorts);
    }
}
