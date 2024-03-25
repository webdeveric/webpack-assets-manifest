/* eslint-disable @typescript-eslint/naming-convention */
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import CompressionPlugin from 'compression-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { SubresourceIntegrityPlugin } from 'webpack-subresource-integrity';

import { tmpDirPath } from './utils.js';

import type { Configuration } from 'webpack';
import 'webpack-dev-server';
import type Server from 'webpack-dev-server';

type Output = NonNullable<Configuration['output']>;

type OutputWithPath = Omit<Output, 'path'> & Required<Pick<Output, 'path'>>;

export type ConfigurationForTests = Omit<Configuration, 'plugins' | 'output'> &
  Required<Pick<Configuration, 'plugins'>> & { output: OutputWithPath };

const fixturesDir = fileURLToPath(new URL('./fixtures', import.meta.url));

export function hello(): ConfigurationForTests {
  return {
    mode: 'development',
    infrastructureLogging: {
      debug: true,
      level: 'verbose',
    },
    entry: {
      main: resolve(fixturesDir, './hello.js'),
    },
    output: {
      path: tmpDirPath(),
    },
    module: {
      rules: [],
    },
    plugins: [],
  };
}

export function client(hashed = false): ConfigurationForTests {
  return {
    mode: 'development',
    target: 'web',
    infrastructureLogging: {
      debug: true,
      level: 'verbose',
    },
    entry: {
      client: resolve(fixturesDir, './client.js'),
    },
    output: {
      path: tmpDirPath(),
      filename: hashed ? '[name]-[contenthash:6]-[chunkhash].js' : '[name].js',
    },
    optimization: {
      realContentHash: true,
    },
    module: {
      rules: [
        {
          test: /\.loader\.jpg$/i,
          loader: 'file-loader',
          options: {
            name: hashed ? 'images/[name]-[contenthash:6].[ext]' : 'images/[name].[ext]',
          },
        },
        {
          test: /\.asset\.jpg$/i,
          type: 'asset/resource',
          generator: {
            filename: hashed ? 'images/[name]-[contenthash:6][ext]' : 'images/[name][ext]',
          },
        },
      ],
    },
    plugins: [],
  };
}

export function styles(): ConfigurationForTests {
  return {
    mode: 'development',
    target: 'web',
    entry: {
      styles: resolve(fixturesDir, './load-styles.mjs'),
    },
    output: {
      path: tmpDirPath(),
      filename: '[name].js',
      publicPath: '/',
    },
    module: {
      rules: [
        {
          test: /\.jpg$/i,
          type: 'asset/resource',
          generator: {
            filename: 'images/[name]-[contenthash:6][ext]',
          },
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
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

export function copy(): ConfigurationForTests {
  const config = hello();

  config.plugins.push(
    new CopyPlugin({
      patterns: [
        {
          from: join(fixturesDir, 'readme.md'),
          to: './readme-copied.md',
        },
      ],
    }),
  );

  return config;
}

export function compression(): ConfigurationForTests {
  const config = hello();

  config.plugins.push(new CompressionPlugin());

  return config;
}

export function sri(): ConfigurationForTests {
  const config = hello();

  config.output = {
    crossOriginLoading: 'anonymous',
    path: tmpDirPath(),
  };

  config.plugins.push(
    new SubresourceIntegrityPlugin({
      enabled: true,
      hashFuncNames: ['sha256'],
    }),
  );

  return config;
}

export function complex(): ConfigurationForTests {
  return {
    mode: 'development',
    target: 'web',
    context: fixturesDir,
    entry: {
      main: './main.js',
      complex: './complex.mjs',
    },
    output: {
      path: tmpDirPath(),
      filename: '[name]-HASH.js',
      publicPath: 'https://assets.example.com/',
    },
    module: {
      rules: [
        {
          test: /\.jpg$/i,
          type: 'asset/resource',
          generator: {
            filename: 'images/[name].HASH[ext][query]',
          },
        },
        {
          test: /\.css$/i,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name]-HASH.css',
      }),
    ],
  };
}

export function server(): ConfigurationForTests {
  return {
    mode: 'development',
    target: 'node',
    entry: {
      server: resolve(fixturesDir, './server.js'),
    },
    stats: 'errors-only',
    output: {
      path: tmpDirPath(),
      filename: '[name].js',
    },
    module: {
      rules: [],
    },
    plugins: [],
  };
}

export function devServer(
  writeToDisk: NonNullable<Server['options']['devMiddleware']>['writeToDisk'] = false,
): ConfigurationForTests {
  const config = server();

  config.devServer = {
    hot: true,
    devMiddleware: {
      stats: 'errors-only',
      writeToDisk,
    },
  };

  return config;
}

export function multi(): Configuration[] {
  const clientConfig = client();
  const serverConfig = server();

  clientConfig.output.path = serverConfig.output.path = tmpDirPath();

  return [clientConfig, serverConfig];
}
