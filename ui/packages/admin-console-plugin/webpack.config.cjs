const path = require('path');
const { ConsoleRemotePlugin } = require('@openshift-console/dynamic-plugin-sdk-webpack');

const pluginMetadata = require('./package.json').consolePlugin;

module.exports = {
  mode: 'production',
  entry: {},
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name]-bundle.js',
    chunkFilename: '[name]-chunk.js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@hybridsovereign/shared': path.resolve(__dirname, '../shared/src'),
      i18next: path.resolve(__dirname, '../../node_modules/i18next'),
      'react-i18next': path.resolve(__dirname, '../../node_modules/react-i18next'),
    },
  },
  module: {
    rules: [
      {
        test: /\.(tsx?|jsx?)$/,
        exclude: /node_modules/,
        use: [{ loader: 'ts-loader', options: { transpileOnly: true } }],
      },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  plugins: [
    new ConsoleRemotePlugin({
      pluginMetadata,
      validateSharedModules: false,
    }),
  ],
  devtool: 'source-map',
};
