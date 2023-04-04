## Kaoto Editor

![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/redhat.vscode-kaoto.svg)
![vs-code-support](https://img.shields.io/badge/Visual%20Studio%20Code-1.46.0+-blue.svg)
[![Build with released version of Kaoto UI](https://github.com/KaotoIO/vscode-kaoto/actions/workflows/ci.yaml/badge.svg)](https://github.com/KaotoIO/vscode-kaoto/actions/workflows/ci.yaml)
[![Build with main branch of kaoto-ui](https://github.com/KaotoIO/vscode-kaoto/actions/workflows/main-kaoto.yaml/badge.svg)](https://github.com/KaotoIO/vscode-kaoto/actions/workflows/main-kaoto.yaml)

### **This is a pre-release version to seek feedback from the community**

[Kaoto](https://www.kaoto.io) is an integration editor to create and deploy workflows in a visual, low-code way; with developer-friendly features like a code editor and deployments to the cloud. Kaoto augments user productivity via [Apache Camel](https://camel.apache.org/): it accelerates new users and helps experienced developers.

## Prerequisites

- Requires `Amd64` architecture

## Features

- Edit Kaoto (`*.kaoto.yaml` and `*.kaoto.yml`) files.
- Edit Camel files following pattern (`*.camel.yaml` and `*.camel.yml`). Beware that the unsupported elements by Kaoto are removed from the file.
- Allow to edit `*.yaml` and `*.yml` when opening through contextual menu. Beware that the unsupported elements by Kaoto are removed from the file.

![Create file named demo.kaoto.yaml, it opens automatically, then add 2 steps in embedded Kaoto UI and save the editor](images/basicDemo.gif)

## Versions under the hood

Kaoto UI is embedded in version 1.0.0-rc1. Kaoto backend is launched natively using version 1.0.0-rc1.

## Limitations

- Requires `Amd64` architecture
- Port 8081 must be available
- Kaoto files are always written and overwritten with Linux-style end of line
- Unsupported elements by Kaoto are removed from the files when opening them. The editor will open in dirty state in this case.

## Data and Telemetry

The VS Code Kaoto extension collects anonymous [usage data](USAGE_DATA.md) and sends it to Red Hat servers to help improve our products and services. Read our [privacy statement](https://developers.redhat.com/article/tool-data-collection) to learn more. This extension respects the `redhat.telemetry.enabled` setting which you can learn more about at https://github.com/redhat-developer/vscode-redhat-telemetry#how-to-disable-telemetry-reporting
