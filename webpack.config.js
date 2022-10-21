const { merge } = require("webpack-merge");
const webpack = require('webpack');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const path = require("path");
const BG_IMAGES_DIRNAME = "bgimages";

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
                  sourceMap: sourceMaps,
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
      // Required for github.dev, `minimatch` and vscode-redhat-telemetry, as Webpack 5 doesn't add polyfills automatically anymore.
      fallback: {
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
        "@patternfly/react-core": path.resolve('./node_modules/@patternfly/react-core')
      },
      plugins: [
        new TsconfigPathsPlugin({
          configFile: path.resolve(__dirname, './tsconfig.json'),
        }),
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.KAOTO_API': JSON.stringify("http://localhost:8081")
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
      "extension/extensionWeb": "./src/extension/extension.ts",
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
                (input) => posixPath(input).includes("node_modules/@patternfly/patternfly/assets/fonts"),
                (input) => posixPath(input).includes("node_modules/@patternfly/patternfly/assets/pficon"),
                (input) =>
                  posixPath(input).includes("node_modules/monaco-editor/esm/vs/base/browser/ui/codicons/codicon"),
                (input) =>
                  posixPath(input).includes("node_modules/monaco-editor/dev/vs/base/browser/ui/codicons/codicon"),
              ],
            },
          ],
          use: {
            loader: "file-loader",
            options: {
              // Limit at 50k. larger files emitted into separate files
              limit: 5000,
              outputPath: "fonts",
              name: "[name].[ext]",
            },
          },
        },
        {
          test: /\.svg$/,
          include: (input) => input.indexOf("background-filter.svg") > 1,
          use: [
            {
              loader: "url-loader",
              options: {
                limit: 5000,
                outputPath: "svgs",
                name: "[name].[ext]",
              },
            },
          ],
        },
        {
          test: /\.svg$/,
          // only process SVG modules with this loader if they live under a 'bgimages' directory
          // this is primarily useful when applying a CSS background using an SVG
          include: (input) => input.indexOf(BG_IMAGES_DIRNAME) > -1,
          use: {
            loader: "svg-url-loader",
            options: {},
          },
        },
        {
          test: /\.svg$/,
          // only process SVG modules with this loader when they don't live under a 'bgimages',
          // 'fonts', or 'pficon' directory, those are handled with other loaders
          include: (input) =>
            input.indexOf(BG_IMAGES_DIRNAME) === -1 &&
            input.indexOf("fonts") === -1 &&
            input.indexOf("background-filter") === -1 &&
            input.indexOf("pficon") === -1,
          use: {
            loader: "raw-loader",
            options: {},
          },
        },
        {
          test: /\.(jpg|jpeg|png|gif)$/i,
          include: [
            {
              or: [
                (input) => posixPath(input).includes("src"),
                (input) => posixPath(input).includes("dist/lib/assets/images"),
                (input) => posixPath(input).includes("node_modules/kaoto-ui/dist/lib/assets/images"),
                (input) => posixPath(input).includes("node_modules/@patternfly/patternfly/assets/images"),
                (input) => posixPath(input).includes("node_modules/@patternfly/react-styles/css/assets/images"),
                (input) => posixPath(input).includes("node_modules/@patternfly/react-core/dist/styles/assets/images"),
                (input) =>
                  posixPath(input).includes(
                    "node_modules/@patternfly/react-core/node_modules/@patternfly/react-styles/css/assets/images"
                  ),
                (input) =>
                  posixPath(input).includes(
                    "node_modules/@patternfly/react-table/node_modules/@patternfly/react-styles/css/assets/images"
                  ),
                (input) =>
                  posixPath(input).includes(
                    "node_modules/@patternfly/react-inline-edit-extension/node_modules/@patternfly/react-styles/css/assets/images"
                  ),
              ],
            },
          ],
          use: [
            {
              loader: "url-loader",
              options: {
                limit: 5000,
                outputPath: "images",
                name: "[name].[ext]",
              },
            },
          ],
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
