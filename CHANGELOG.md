# 2.7.0

- Upgrade to Kaoto 2.7.0-RC2
  - /!\ BREAKING CHANGE: if using a specific Kaoto Catalog, it must be regenerated with newer Kaoto otherwise the editor won't open.
- Support for switching themes independently of VS Code theme
  - The Kaoto editor must closed/reopened to have theme applied
- Upgrade default Camel JBang version from 4.11.0 to 4.14.0
  - Note that due to regression [CAMEL-22131](https://issues.apache.org/jira/browse/CAMEL-22131) in Camel JBang 4.12, the project creation on Windows doesn't include the Maven wrapper with 4.12.x Camel Jbang version.
- Drag-and-Drop functionality on Kaoto canvas now enabled by default

# 2.6.0

- Upgrade to Kaoto 2.6.0
- Add recommended extensions pop up notification

# 2.5.0

- `Breaking:` Remove legacy support for Kaoto v1 file patterns (`*.kaoto.yaml`, `*.kaoto.yml`)
- `Breaking:` Bump minimal VS Code version from 1.74.0 to 1.95.0
- Potential breakage: when using a Camel Jbang version strictly prior to 4.11, the parameter `--disable-auto` must be removed from the setting `Kubernetes Run Parameters`
- Upgrade to Kaoto 2.5.0
- Add Kaoto view container with initial Help & Feedback view
- Improve toggle source code (open/close camel file in a side textual editor) using one button
- Add Integrations view into Kaoto view container
- Add `New File...` button into `Kaoto: Integrations` view
- Add automatically Apache Camel into JBang Trusted Sources
- add welcome content into Kaoto: Integrations view
  - show Open Folder when there is no workspace
  - show New Camel File if no Camel related file is found in workspace (when Integrations view is empty)
- send events into Red hat Telemetry for Kaoto extension commands
- Add `Export` inline button into Kaoto: Integrations view
- Add `Run` inline button into Kaoto: Integrations view
- Add `Deploy` inline button into Kaoto: Integrations view
- Add support for XML files - `*.camel.xml` files are automatically opened in Kaoto editor
  - Kaoto: Integrations view
    - create new Camel Route using XML DSL
    - list XML files with route elements
- Add `Deployments` view into Kaoto view container which displays all local running integrations
- Add `Stop` and `Follow Logs` action buttons into Deployments view
- Add `Start/Stop/Suspend/Resume` action button on `route` level within Deployments view
- Support for Dark theme
  - The Kaoto editor must closed/reopened to have theme applied
  - The High Contrast Dark Theme is not supported

# 2.4.0

- Fix Kaoto Datamapper editor on Windows (issue when attaching an xsd)
- Upgrade to Kaoto 2.4.0
- Add the possibility to select how to show the Step toolbar (onHover or onSelection)
- Add the possibility to enable drag & drop experimental feature

# 2.3.0

- Introduced a `Kaoto` output channel. It is initially used to log message of exceptions.
- Upgrade to Kaoto 2.3.0
- Start attempt to have VS Code Kaoto version number aligned with version of Kaoto that is embedded

# 1.3.0

- Enable `nodeLabel` setting to configure the node label used in the Kaoto editor
- Upgrade Kaoto 2.2.0
- Provide command and quick action `Open Camel file with textual editor on the side` when Kaoto editor is active
- Provide shortcut `Ctrl+k v` to open textual editor to the side when kaoto editor is active
- Fix rendering in vscode.dev
- Fix commands in vscode.dev

# 1.2.0

- Update project homepage in the marketplace to [kaoto.io](https://kaoto.io)
- Setting to provide custom set of Catalog used by the Kaoto editor
- Upgrade Kaoto 2.1.0

# 1.1.0

- Update Red Hat telemetry dependency to reduce number of event sent (startup information will be sent one time per day per user)

# 1.0.0

- Remove `preview` flag

# 0.17.0

- Update animated image in readme

# 0.16.0

- Upgrade from Kaoto 2 preview release 2.0.0-TP3 to 2.0.0

# 0.15.0

- Upgrade from Kaoto 2 preview release 2.0.0-TP2 to 2.0.0-TP3

# 0.14.0

- Open Kaoto editor by default for `*.pipe.(yaml|yml)` and `*-pipe.(yaml|yml)`files

# 0.13.0

- Upgrade from Kaoto 2 preview release 2.0.0-TP1.2 to 2.0.0-TP2

# 0.12.0

- Fix Kaoto editor in vscode.dev web environment
- Upgrade from Kaoto 2 preview release 2.0.0-TP1 to 2.0.0-TP1.2

# 0.11.0

- Use Kaoto 2 preview release (technically kaoto-next 2.0.0-TP1) instead of Kaoto UI + Kaoto backend
- Remove kaoto backend v1: reduced size of bundle and no more requirements on architecture
- Open Kaoto editor by default for `*.kamelet.(yaml|yml)` files

# 0.10.0

- Upgrade embedded Kaoto [UI](https://github.com/KaotoIO/kaoto-ui/releases/tag/v1.4.0) and [backend](https://github.com/KaotoIO/kaoto-backend/releases/tag/v1.4.0) to 1.3.0

# 0.9.0

- Upgrade embedded Kaoto [UI](https://github.com/KaotoIO/kaoto-ui/releases/tag/v1.3.0) and [backend](https://github.com/KaotoIO/kaoto-backend/releases/tag/v1.3.0) to 1.3.0

# 0.8.0

- Upgrade embedded Kaoto [UI](https://github.com/KaotoIO/kaoto-ui/releases/tag/v1.2.1) to 1.2.1 and [backend](https://github.com/KaotoIO/kaoto-backend/releases/tag/v1.2.0) to 1.2.0

# 0.7.0

- Upgrade embedded Kaoto [UI](https://github.com/KaotoIO/kaoto-ui/releases/tag/v1.1.0) to 1.1.0 and [backend](https://github.com/KaotoIO/kaoto-backend/releases/tag/v1.1.1) to 1.1.1

# 0.6.0

- Change default port of embedded Kaoto backend from `8081` to `8097`

# 0.5.0

- Upgrade embedded Kaoto [UI](https://github.com/KaotoIO/kaoto-ui/releases/tag/v1.0.0) to 1.0.0 and [backend](https://github.com/KaotoIO/kaoto-backend/releases/tag/v1.0.0) to 1.0.0

# 0.4.0

- Upgrade embedded Kaoto [UI](https://github.com/KaotoIO/kaoto-ui/releases/tag/v1.0.0-rc1) to 1.0.0-rc1 and [backend](https://github.com/KaotoIO/kaoto-backend/releases/tag/v1.0.0-rc1) to 1.0.0-rc1

# 0.3.0

- Keep `Kaoto backend` output log available when Kaoto backend native executable cannot be launched. It allows to have more information what can be the issue.
- Upgrade embedded Kaoto [UI](https://github.com/KaotoIO/kaoto-ui/releases/tag/v0.7.6) to 0.7.6 and [backend](https://github.com/KaotoIO/kaoto-backend/releases/tag/v0.7.6) to 0.7.6
- Open Kaoto editor by default for `*.camel.(yaml|yml)` files
- Provide entry in contextual menu to open `*.(yaml|yml)` files with Kaoto editor
- Avoid wipeout of content on restart with opened editors #144

# 0.2.0

- Technical version to be able to push on Marketplace

# 0.1.0

- Initial version: Open a Kaoto file, edit it and save it inside VS Code.
