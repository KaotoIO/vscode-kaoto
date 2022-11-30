## Kaoto Editor

![vs-code-support](https://img.shields.io/badge/Visual%20Studio%20Code-1.46.0+-blue.svg)
[![Build with released version of Kaoto UI](https://github.com/KaotoIO/vscode-kaoto/actions/workflows/ci.yaml/badge.svg)](https://github.com/KaotoIO/vscode-kaoto/actions/workflows/ci.yaml)
[![Build with main branch of kaoto-ui](https://github.com/KaotoIO/vscode-kaoto/actions/workflows/main-kaoto.yaml/badge.svg)](https://github.com/KaotoIO/vscode-kaoto/actions/workflows/main-kaoto.yaml)

### **This is a pre-release version to seek feedback from the community**

## Prerequisites

- Must be running on Linux or MacOS

## Features

- Edit Kaoto (`*.kaoto.yaml` and `*.kaoto.yml`) files.

![Create file named demo.kaoto.yaml, it opens automatically, then add 2 steps in embedded Kaoto UI and save the editor](images/basicDemo.gif)

## Versions under the hood

Kaoto UI is embedded in version 0.4.1. Kaoto backend is launched natively using tag 0.4.0.

## Limitations

- It is working only on Linux and MacOS
- Port 8081 must be available

## Data and Telemetry

The VS Code Kaoto extension collects anonymous [usage data](USAGE_DATA.md) and sends it to Red Hat servers to help improve our products and services. Read our [privacy statement](https://developers.redhat.com/article/tool-data-collection) to learn more. This extension respects the `redhat.telemetry.enabled` setting which you can learn more about at https://github.com/redhat-developer/vscode-redhat-telemetry#how-to-disable-telemetry-reporting
