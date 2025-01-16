const { merge } = require('webpack-merge');
const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');
function posixPath(pathStr) {
  return pathStr.split(path.sep).join(path.posix.sep);
}

const getEnvConfig = (env) => {
  if (env.dev) {
    return {
      minimize: false,
      transpileOnly: false,
      sourceMaps: true,
      mode: "development",
      live: env.live,
    };
  } else {
    return {
      minimize: true,
      transpileOnly: false,
      sourceMaps: false,
      mode: "production",
      live: env.live,
    };
  }
};

const commonConfig = (env) => {
  const { transpileOnly, minimize, sourceMaps, mode, live } = getEnvConfig(env);

  console.info(`Webpack :: ts-loader :: transpileOnly: ${transpileOnly}`);
  console.info(`Webpack :: minimize: ${minimize}`);
  console.info(`Webpack :: sourceMaps: ${sourceMaps}`);
  console.info(`Webpack :: mode: ${mode}`);
  console.info(`Webpack :: live: ${live}`);

  const sourceMapsLoader = sourceMaps
    ? [
        {
          test: /\.js$/,
          enforce: "pre",
          use: ["source-map-loader"],
        },
      ]
    : [];

  const devtool = sourceMaps
    ? {
        devtool: "inline-source-map",
      }
    : {};

  const importsNotUsedAsValues = live ? { importsNotUsedAsValues: "preserve" } : {};

  return {
    mode,
    optimization: {
      minimize,
    },
    ...devtool,
    module: {
      rules: [
        ...sourceMapsLoader,
        {
          test: /\.m?js/,
          resolve: {
            fullySpecified: false,
          },
        },
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: "ts-loader",
              options: {
                transpileOnly,
                compilerOptions: {
                  ...importsNotUsedAsValues,
                  sourceMap: sourceMaps
                },
              },
            },
          ],
        },
      ],
    },
	ignoreWarnings: [/Failed to parse source map/],
    output: {
      path: path.resolve("./dist"),
      filename: "[name].js",
      chunkFilename: "[name].bundle.js",
      library: "KaotoEditor",
      libraryTarget: "umd",
      umdNamedDefine: true,
      globalObject: "this",
    },
    stats: {
      excludeAssets: [(name) => !name.endsWith(".js")],
      excludeModules: true,
    },
    performance: {
      maxAssetSize: 30000000,
      maxEntrypointSize: 30000000,
    },
    resolve: {
      // Required for github.dev and `minimatch` as Webpack 5 doesn't add polyfills automatically anymore.
      fallback: {
        constants: require.resolve("constants-browserify"),
        path: require.resolve("path-browserify"),
        os: require.resolve("os-browserify/browser"),
        fs: false,
        child_process: false,
        net: false,
        buffer: require.resolve("buffer/"),
      },
      extensions: [".tsx", ".ts", ".js", ".jsx"],
      modules: ["node_modules"],
      alias: {
        "react": path.resolve('./node_modules/react'),
        "react-dom": path.resolve('./node_modules/react-dom'),
        // "@patternfly/react-core": path.resolve('./node_modules/@patternfly/react-core')
      },
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: 'node_modules/@kaoto/kaoto/lib/camel-catalog',
            to: 'webview/editors/kaoto/camel-catalog',
          },
        ]
      })
    ],
    externals: {
      vscode: "commonjs vscode",
    },
  };
};

module.exports = async (env) => [
  merge(commonConfig(env), {
    target: "node",
    entry: {
      "extension/extension": "./src/extension/extension.ts",
    },
  }),
  merge(commonConfig(env), {
    target: "webworker",
    entry: {
      "extension/extensionWeb": "./src/extension/extensionWeb.ts",
    },
  }),
  merge(commonConfig(env), {
    target: "web",
    entry: {
      "webview/KaotoEditorEnvelopeApp": "./src/webview/KaotoEditorEnvelopeApp.ts",
    },
    module: {
      rules: [
        {
          test: /\.s[ac]ss$/i,
          use: ["style-loader", "css-loader", "sass-loader"],
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
        {
          test: /\.(svg|ttf|eot|woff|woff2)$/,
          include: [
            {
              or: [
                (input) => posixPath(input).includes("node_modules/@patternfly/react-core/dist/styles/assets/fonts"),
                (input) => posixPath(input).includes("node_modules/@patternfly/react-core/dist/styles/assets/pficon"),
                (input) =>
                  posixPath(input).includes("node_modules/monaco-editor/esm/vs/base/browser/ui/codicons/codicon"),
                (input) =>
                  posixPath(input).includes("node_modules/monaco-editor/dev/vs/base/browser/ui/codicons/codicon"),
              ],
            },
          ],
          type: 'asset',
          generator: {
            filename: 'fonts/[name].[ext]',
          }
        },
        {
          test: /\.(svg|jpg|jpeg|png|gif)$/i,
          type: "asset",
        },
      ],
    },
    ignoreWarnings: [/Failed to parse source map/],
    stats: {
      errorDetails: true,
      children: true,
    },
  }),
];
