// ─── Default Values ──────────────────────────────────────────────────────────

export const DEFAULT_CAMEL_VERSION_FALLBACK: string = '4.20.0';

// ─── Editor Type ─────────────────────────────────────────────────────────────

export const KAOTO_EDITOR_VIEW_TYPE = 'webviewEditorsKaoto';

// ─── Glob Patterns ───────────────────────────────────────────────────────────

export const KAOTO_FILE_PATH_GLOB = '**/*.{yml,yaml,xml}';

export const KAOTO_EXCLUDE_PATTERN = '{**/node_modules/**,**/.vscode/**,**/out/**,**/.citrus-jbang*/**,**/.camel-jbang*/**,**/target/**,**/.mvn/**}';

export const DEFAULT_KAOTO_OPENAPI_FILES_REGEXP: string[] = ['*openapi.yaml', '*openapi.yml', '*openapi.json'];

// ─── Settings IDs ────────────────────────────────────────────────────────────

export const KAOTO_MAVEN_DEPENDENCIES_UPDATE_ON_SAVE_SETTING_ID = 'kaoto.maven.dependenciesUpdate.onSave';

export const KAOTO_LOCAL_KAMELET_DIRECTORIES_SETTING_ID = 'kaoto.localKameletDirectories';

export const KAOTO_INTEGRATIONS_FILES_REGEXP_SETTING_ID = 'kaoto.integrations.files.regexp';

export const KAOTO_TESTS_FILES_REGEXP_SETTING_ID = 'kaoto.tests.files.regexp';

export const KAOTO_OPENAPI_FILES_REGEXP_SETTING_ID = 'kaoto.openapi.files.regexp';

export const KAOTO_REST_APICURIO_REGISTRY_URL_SETTING_ID = 'kaoto.restConfiguration.apicurioRegistryUrl';

export const KAOTO_REST_CUSTOM_MEDIA_TYPES_SETTING_ID = 'kaoto.restConfiguration.customMediaTypes';

export const KAOTO_DEPLOYMENTS_REFRESH_INTERVAL_SETTING_ID = 'kaoto.deployments.refresh.interval';

export const KAOTO_CATALOG_URL_SETTING_ID = 'kaoto.catalog.url';

export const KAOTO_NODE_LABEL_SETTING_ID = 'kaoto.nodeLabel';

export const KAOTO_NODE_TOOLBAR_TRIGGER_SETTING_ID = 'kaoto.nodeToolbarTrigger';

export const KAOTO_COLOR_THEME_SETTING_ID = 'kaoto.colorTheme';

export const KAOTO_CANVAS_LAYOUT_DIRECTION_SETTING_ID = 'kaoto.canvasLayoutDirection';

// ─── Executor Settings IDs ───────────────────────────────────────────────────

export const KAOTO_EXECUTOR_TYPE_SETTING_ID = 'kaoto.executor.type';

export const KAOTO_EXECUTOR_RUN_ARGUMENTS_SETTING_ID = 'kaoto.executor.runArguments';

export const KAOTO_EXECUTOR_RUN_SOURCE_DIR_ARGUMENTS_SETTING_ID = 'kaoto.executor.runFolderOrWorkspaceArguments';

export const KAOTO_EXECUTOR_RED_HAT_MAVEN_REPOSITORY_SETTING_ID = 'kaoto.executor.redHatMavenRepository';

export const KAOTO_EXECUTOR_RED_HAT_MAVEN_REPOSITORY_GLOBAL_SETTING_ID = 'kaoto.executor.redHatMavenRepository.global';

export const KAOTO_EXECUTOR_KUBERNETES_RUN_ARGUMENTS_SETTING_ID = 'kaoto.executor.kubernetesRunArguments';

export const KAOTO_EXECUTOR_EXPORT_ARGUMENTS_SETTING_ID = 'kaoto.maven.executor.exportProjectArguments';

export const KAOTO_RUNTIME_CATALOG_NAME_SETTING_ID = 'kaoto.runtimeCatalogName';

export const KAOTO_TESTING_CATALOG_NAME_SETTING_ID = 'kaoto.testingCatalogName';

// ─── Command IDs ─────────────────────────────────────────────────────────────

export const COMMAND_CAMEL_NEW_FILE = 'kaoto.new.camel.file';

export const COMMAND_CAMEL_ROUTE = 'kaoto.camel.jbang.init.route';

export const COMMAND_CAMEL_KAMELET_YAML = 'kaoto.camel.jbang.init.kamelet.yaml';

export const COMMAND_CAMEL_PIPE_YAML = 'kaoto.camel.jbang.init.pipe.yaml';

export const COMMAND_CITRUS_INIT = 'kaoto.citrus.jbang.init.test';

export const COMMAND_CAMEL_NEW_PROJECT = 'kaoto.camel.jbang.export';

export const COMMAND_CAMEL_NEW_PROJECT_FOLDER = 'kaoto.camel.jbang.export.folder';

export const COMMAND_CAMEL_NEW_PROJECT_WORKSPACE = 'kaoto.camel.jbang.export.workspace';

export const COMMAND_OPENAPI_IMPORT = 'kaoto.openapi.import';

export const COMMAND_UNDO = 'kaoto.undo';

export const COMMAND_REDO = 'kaoto.redo';

export const COMMAND_WHATS_NEW_SHOW = 'kaoto.whatsNew.show';

export const COMMAND_OPEN_SOURCE = 'kaoto.open.source';

export const COMMAND_CLOSE_SOURCE = 'kaoto.close.source';

export const COMMAND_OPEN_WITH_KAOTO = 'kaoto.open';

export const COMMAND_SELECT_CAMEL_CATALOG = 'kaoto.selectCamelCatalog';

export const COMMAND_INTEGRATIONS_REFRESH = 'kaoto.integrations.refresh';

export const COMMAND_INTEGRATIONS_SHOW_SOURCE = 'kaoto.integrations.showSource';

export const COMMAND_INTEGRATIONS_DELETE = 'kaoto.integrations.delete';

export const COMMAND_INTEGRATIONS_UPDATE_DEPENDENCIES = 'kaoto.integrations.updateDependencies';

export const COMMAND_INTEGRATIONS_RUN = 'kaoto.integrations.run';

export const COMMAND_INTEGRATIONS_RUN_FOLDER = 'kaoto.integrations.run.folder';

export const COMMAND_INTEGRATIONS_RUN_WORKSPACE = 'kaoto.integrations.run.workspace';

export const COMMAND_INTEGRATIONS_RUN_ALL_WORKSPACES = 'kaoto.integrations.run.all.workspaces';

export const COMMAND_INTEGRATIONS_KUBERNETES_RUN = 'kaoto.integrations.kubernetes.run';

export const COMMAND_TESTS_REFRESH = 'kaoto.tests.refresh';

export const COMMAND_TESTS_CLEAR_RESULTS = 'kaoto.tests.clearResults';

export const COMMAND_TESTS_RUN = 'kaoto.tests.run';

export const COMMAND_TESTS_RUN_FOLDER = 'kaoto.tests.run.folder';

export const COMMAND_TESTS_SHOW_SOURCE = 'kaoto.tests.showSource';

export const COMMAND_TESTS_DELETE = 'kaoto.tests.delete';

export const COMMAND_OPENAPI_REFRESH = 'kaoto.openapi.refresh';

export const COMMAND_OPENAPI_SHOW_SOURCE = 'kaoto.openapi.showSource';

export const COMMAND_OPENAPI_DELETE = 'kaoto.openapi.delete';

export const COMMAND_DEPLOYMENTS_REFRESH = 'kaoto.deployments.refresh';

export const COMMAND_DEPLOYMENTS_STOP = 'kaoto.deployments.stop';

export const COMMAND_DEPLOYMENTS_LOGS = 'kaoto.deployments.logs';

export const COMMAND_DEPLOYMENTS_ROUTE_START = 'kaoto.deployments.route.start';

export const COMMAND_DEPLOYMENTS_ROUTE_STOP = 'kaoto.deployments.route.stop';

export const COMMAND_DEPLOYMENTS_ROUTE_RESUME = 'kaoto.deployments.route.resume';

export const COMMAND_DEPLOYMENTS_ROUTE_SUSPEND = 'kaoto.deployments.route.suspend';

// ─── View IDs ────────────────────────────────────────────────────────────────

export const VIEW_HELP = 'kaoto.help';

export const VIEW_INTEGRATIONS = 'kaoto.integrations';

export const VIEW_TESTS = 'kaoto.tests';

export const VIEW_DEPLOYMENTS = 'kaoto.deployments';

export const VIEW_OPENAPI = 'kaoto.openapi';

export const VIEW_WHATS_NEW = 'kaoto.whatsNew';

// ─── Context Keys ────────────────────────────────────────────────────────────

export const CONTEXT_EXECUTOR_AVAILABLE = 'kaoto.executorAvailable';

export const CONTEXT_WORKSPACE_HAS_POM_XML = 'kaoto.workspaceHasPomXml';

export const CONTEXT_INTEGRATION_EXISTS = 'kaoto.integrationExists';

export const CONTEXT_TEST_EXISTS = 'kaoto.testExists';

export const CONTEXT_TEST_RESULTS_EXIST = 'kaoto.testResultsExist';

// ─── Global State Keys ───────────────────────────────────────────────────────

export const STATE_LAST_WHATS_NEW_SHOWN_VERSION = 'kaoto.lastWhatsNewShownVersion';

export const STATE_SHOW_RUN_ALL_FOLDERS_MESSAGE = 'kaoto.showRunAllFoldersMessage';

// ─── Trusted Source URLs ─────────────────────────────────────────────────────

export const CAMEL_TRUSTED_SOURCE_URL = 'https://github.com/apache/camel/';

export const CITRUS_TRUSTED_SOURCE_URL = 'https://github.com/citrusframework/citrus/';
