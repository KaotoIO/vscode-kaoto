<h1 align="center">
  <img src="./images/logo-kaoto-dark.png">
</h1>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=redhat.vscode-kaoto"><img src="https://img.shields.io/visual-studio-marketplace/v/redhat.vscode-kaoto?style=for-the-badge" alt="Marketplace Version"/></a>
  <img src="https://img.shields.io/badge/VS%20Code-1.46.0+-blue?style=for-the-badge" alt="Visual Studio Code Support"/>
  <a href="https://github.com/KaotoIO/vscode-kaoto/blob/main/LICENSE"><img src="https://img.shields.io/github/license/KaotoIO/vscode-kaoto?color=blue&style=for-the-badge" alt="License"/></a>
  <a href="https://camel.zulipchat.com/#narrow/stream/258729-camel-tooling"><img src="https://img.shields.io/badge/zulip-join_chat-brightgreen?color=yellow&style=for-the-badge" alt="Zulip"/></a></br>
  <a href="https://github.com/KaotoIO/vscode-kaoto/actions/workflows/main-kaoto.yaml"><img src="https://img.shields.io/github/actions/workflow/status/KaotoIO/vscode-kaoto/main-kaoto.yaml?style=for-the-badge&label=main%20kaoto%20ui" alt="Build with Main branch of Kaoto UI"></a>
  <a href="https://github.com/KaotoIO/vscode-kaoto/actions/workflows/ci.yaml"><img src="https://img.shields.io/github/actions/workflow/status/KaotoIO/vscode-kaoto/ci.yaml?style=for-the-badge&label=released%20kaoto%20ui" alt="Build with Released version of Kaoto UI"></a>
</p><br/>

<h2 align="center">No Code and Low Code Integration editor</h2>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#requirements">Requirements</a> •
  <a href="https://kaoto.io/docs/">Documentation</a> •
  <a href="#issues">Issues</a>  •
  <a href="#data-and-telemetry">Telemetry</a>
</p>

<p align="center">
<a href="https://www.kaoto.io">Kaoto</a> is an integration editor to create and deploy workflows in a visual, low-code way, with developer-friendly features like a code editor and deployments to the cloud. Kaoto augments user productivity via <a href="https://camel.apache.org">Apache Camel</a>. It accelerates new users and helps experienced developers.
</p><br/>

<p align="center"><img src="images/basicDemo.gif" alt="Create file named demo.kaoto.yaml, it opens automatically, then add 2 steps in embedded Kaoto UI and save the editor" width="100%"/></p>

### Features

- Edit Kaoto (`*.kaoto.yaml` and `*.kaoto.yml`) files.
- Edit Camel files following pattern (`*.camel.yaml` and `*.camel.yml`).
- Allow to edit `*.yaml` and `*.yml` when opening through contextual menu.

### Limitations

- Kaoto files are always written and overwritten with `Linux-style` end of line (EOL).
- Unsupported elements by Kaoto are removed from the files when opening them. The editor will open in dirty state in this case.

### Embedded

- [Kaoto UI](https://github.com/KaotoIO/kaoto-ui) in version [1.4.0](https://github.com/KaotoIO/kaoto-ui/releases/tag/v1.4.0).

### Issues

Something is not working properly? In that case, feel free to [open issues, add feature requests, report bugs, etc.](https://github.com/KaotoIO/vscode-kaoto/issues).

### Get Involved

If you'd like to help us get better, we appreciate it!
Check out our [Contribution Guide](CONTRIBUTING.md) on how to do that.

### Data and Telemetry

The Kaoto for Visual Studio Code extension collects anonymous [usage data](USAGE_DATA.md) and sends it to Red Hat servers to help improve our products and services. Read our [privacy statement](https://developers.redhat.com/article/tool-data-collection) to learn more. This extension respects the `redhat.telemetry.enabled` setting which you can learn more about at [How to disable Telemetry reporting](https://github.com/redhat-developer/vscode-redhat-telemetry#how-to-disable-telemetry-reporting).
