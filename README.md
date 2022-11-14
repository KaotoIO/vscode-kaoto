## Kaoto Editor

![vs-code-support](https://img.shields.io/badge/Visual%20Studio%20Code-1.46.0+-blue.svg)
[![Build with main branch of kaoto-ui](https://github.com/KaotoIO/vscode-kaoto/actions/workflows/main-kaoto.yaml/badge.svg)](https://github.com/KaotoIO/vscode-kaoto/actions/workflows/main-kaoto.yaml)

### **This is a pre-release version to seek feedback from the community**

## Prerequisites

- `docker` must be available on system path

## Features

- Edit Kaoto (`*.kaoto.yaml` and `*.kaoto.yml`) files.

![Create file named demo.kaoto.yaml, it opens automatically, then add 2 steps in embedded Kaoto UI and save the editor](images/basicDemo.gif)

## Versions under the hood

Kaoto UI is embedded in version 0.4.1. Kaoto backend is launched through `docker` using tag 0.4.0.

## Limitations

- It is working only on Linux. The docker image used is not multi-arch.
- `Deploy` button in Kaoto Editor is not working
- The first time, the UI of the editor can take several minutes to load. It is the time to download a Docker image.

## Data and Telemetry

The VS Code Kaoto extension collects anonymous [usage data](USAGE_DATA.md) and sends it to Red Hat servers to help improve our products and services. Read our [privacy statement](https://developers.redhat.com/article/tool-data-collection) to learn more. This extension respects the `redhat.telemetry.enabled` setting which you can learn more about at https://github.com/redhat-developer/vscode-redhat-telemetry#how-to-disable-telemetry-reporting
