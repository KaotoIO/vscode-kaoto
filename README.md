<h1 align="center">
  <img src="./images/logo-kaoto.png" alt="Kaoto">
</h1>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=redhat.vscode-kaoto"><img src="https://img.shields.io/visual-studio-marketplace/v/redhat.vscode-kaoto?style=for-the-badge&color=yellow" alt="Marketplace Version"/></a>
  <a href="https://github.com/KaotoIO/kaoto/releases"><img alt="Kaoto UI version" src="https://img.shields.io/badge/Kaoto_UI-2.5.0-yellow?style=for-the-badge&logo=npm"></a>
  <img src="https://img.shields.io/badge/VS%20Code-1.95+-yellow?style=for-the-badge" alt="Visual Studio Code Support"/>
  <br/>
  <a href="https://github.com/KaotoIO/vscode-kaoto/blob/main/LICENSE"><img src="https://img.shields.io/github/license/KaotoIO/vscode-kaoto?color=yellow&style=for-the-badge&logo=apache" alt="License"/></a>
  <a href="https://camel.zulipchat.com/#narrow/stream/258729-camel-tooling"><img src="https://img.shields.io/badge/zulip-join_chat-brightgreen?color=yellow&style=for-the-badge&logo=zulip&logoColor=white" alt="Zulip"/></a></br>
  <a href="https://github.com/KaotoIO/vscode-kaoto/actions/workflows/main-kaoto.yaml"><img src="https://img.shields.io/github/actions/workflow/status/KaotoIO/vscode-kaoto/main-kaoto.yaml?style=for-the-badge&logo=githubactions&logoColor=white&label=main%20kaoto%20ui" alt="Build with Main branch of Kaoto UI"></a>
  <a href="https://github.com/KaotoIO/vscode-kaoto/actions/workflows/ci.yaml"><img src="https://img.shields.io/github/actions/workflow/status/KaotoIO/vscode-kaoto/ci.yaml?style=for-the-badge&logo=githubactions&logoColor=white&label=released%20kaoto%20ui" alt="Build with Released version of Kaoto UI"></a>
</p><br/>

<h2 align="center">Kaoto - The Integration Designer for <a href="https://camel.apache.org">Apache Camel</a></h2>

<p align="center">
  <a href="#feature-highlights">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="https://kaoto.io/docs/manual/">Documentation</a> •
  <a href="#feedback">Feedback</a>  •
  <a href="#data--telemetry">Telemetry</a>
</p>

<p align="center">
<a href="https://www.kaoto.io">Kaoto</a> lowers the barrier to getting started with <a href="https://camel.apache.org">Apache Camel</a>, enabling users to quickly prototype and integrate systems without deep Camel knowledge or complex Java coding. With a modern, open-source visual designer, Kaoto empowers teams to build and test integrations efficiently in a low-code environment, accelerating the development process.
</p><br/>

<p align="center"><img src="./images/intro-kaoto.png" alt="Shows Kaoto - The Integration Designer for Apache Camel" width="90%"/></p>

## Feature Highlights

- 📝 **Design and edit Camel files** with an intuitive low-code interface.
- ⚙️ **Extensive customization options** including defining a custom catalog and other user-configurable settings to tailor your workflow experience.
- 🔎 Discover **powerful views**, gain full control over your integrations.
  - **Browse** and navigate all integration files with ease.
  - **Orchestrate** and manage all Camel integrations running locally through a dedicated view
  - **Initialize** Camel Routes, Pipes and Kamelets quickly.
  - **Export** integrations as **Maven projects** for Quarkus or Spring Boot deployments.
  - **Run locally** – Test and execute individual integration files effortlessly.
  - **Deploy to OpenShift/Kubernetes** – Deploy a single integration file seamlessly.
    - For Minikube, check out the [Deployment Tips & Troubleshooting Guide](https://camel.apache.org/manual/camel-jbang-kubernetes.html#_minikube_deployment_tips_and_troubleshooting).

## Supported Formats

- **Camel Route files**: `*.camel.yaml`, `*.camel.xml`
- **Kamelet files**: `*.kamelet.yaml`
- **Pipe files**: `*.pipe.yaml`

## Installation

You can follow [Installation Guide](https://kaoto.io/docs/installation) on a Kaoto official site or steps below:

1. Download and install **VS Code**.
2. Install the **Kaoto extension** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-kaoto) or [Open VSX Registry](https://open-vsx.org/extension/redhat/vscode-kaoto)

## Documentation

Learn more about Kaoto and how to use it effectively:

- 📘 [User Manual](https://kaoto.io/docs/manual/) - In-depth guide on all features and configurations.
- 🚀 [Quickstart Guide](https://kaoto.io/docs/quickstart/) - Get started with Kaoto in minutes.
- 🛠️ [Installation Guide](https://kaoto.io/docs/installation/) - Step-by-step instructions for installing Kaoto.

## Snapshots

If you want to test the latest snapshot versions from the Kaoto VS Code extension repository `main` branch, two types of binaries (`*.vsix`) are available:

1. **Snapshot** using a **released Kaoto version**: [Download here](https://download.jboss.org/jbosstools/vscode/snapshots/vscode-kaoto/).
2. **Snapshot** using the **latest Kaoto build**: [Find the latest build](https://github.com/KaotoIO/vscode-kaoto/actions/workflows/main-kaoto.yaml?query=branch%3Amain), download the `vsix-from-main-branch-of-kaoto.zip` artifact, and extract the `.vsix` file.

To install a `.vsix` binary, refer to the [official VS Code guide](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix).

## Feedback

- **We value your feedback!** If you encounter any issues, have feature requests, or want to suggest improvements, please [open an issue](https://github.com/KaotoIO/vscode-kaoto/issues) in our repository.
- **We welcome contributions!** Check out our [Contribution Guide](CONTRIBUTING.md) for details on how to help improve Kaoto.

## Data & Telemetry

The Kaoto VS Code extension collects anonymous [usage data](USAGE_DATA.md) to enhance our products. Read our [privacy statement](https://developers.redhat.com/article/tool-data-collection) for more details.

This extension respects the `redhat.telemetry.enabled` setting. Learn more: [Disable Telemetry](https://github.com/redhat-developer/vscode-redhat-telemetry#how-to-disable-telemetry-reporting).
