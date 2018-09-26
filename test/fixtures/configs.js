'use strict';

const path = require('path');
const tmpDir = require('os').tmpdir();

function getTmpDir()
{
  return tmpDir;
}

function getWorkspace()
{
  return path.join(tmpDir, 'webpack-assets-manifest');
}

function randomString(length)
{
  let str = '';
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

  while (length--) {
    str += chars[ Math.floor( Math.random() * chars.length ) ];
  }

  return str;
}

function tmpDirPath()
{
  return path.join(getWorkspace(), randomString(8));
}

function hello()
{
  return {
    mode: 'development',
    entry: path.resolve(__dirname, './hello.js'),
    output: {
      path: tmpDirPath(),
      filename: 'bundle.js',
    },
  };
}

function client()
{
  return {
    mode: 'development',
    target: 'web',
    entry: {
      client: path.resolve(__dirname, './client.js'),
    },
    output: {
      path: tmpDirPath(),
      filename: '[name].js',
    },
    module: {
      rules: [
        {
          test: /\.jpg$/i,
          loader: 'file-loader?name=images/[name].[ext]',
        },
      ],
    },
  };
}

function styles()
{
  const MiniCssExtractPlugin = require('mini-css-extract-plugin');

  return {
    mode: 'development',
    target: 'web',
    entry: {
      styles: path.resolve(__dirname, './styles.js'),
    },
    output: {
      path: tmpDirPath(),
      filename: '[name].js',
    },
    module: {
      rules: [
        {
          test: /\.jpg$/i,
          loader: 'file-loader?name=images/[name].[ext]',
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
          ],
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
    ],
  };
}

function server()
{
  return {
    mode: 'development',
    target: 'node',
    entry: {
      server: path.resolve(__dirname, './server.js'),
    },
    output: {
      path: tmpDirPath(),
      filename: '[name].js',
    },
  };
}

function devServer( outputPath )
{
  outputPath = outputPath || '/';

  const config = server();

  config.devServer = { outputPath: outputPath };
  config.output.path = outputPath;

  return config;
}

function multi()
{
  const c = client();
  const s = server();

  c.output.path = s.output.path = tmpDirPath();

  return [ c, s ];
}

module.exports = {
  hello,
  client,
  server,
  devServer,
  multi,
  getTmpDir,
  tmpDirPath,
  getWorkspace,
  styles,
};
