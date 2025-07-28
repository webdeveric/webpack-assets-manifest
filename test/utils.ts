import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createFsFromVolume, Volume } from 'memfs';
import {
  type Compiler,
  type Configuration,
  type Stats,
  webpack,
  type MultiCompiler,
  type MultiStats,
  type MultiConfiguration,
} from 'webpack';

import { WebpackAssetsManifest } from '../src/plugin.js';

export function getWorkspace(): string {
  return join(tmpdir(), 'webpack-assets-manifest');
}

export function tmpDirPath(): string {
  return join(getWorkspace(), randomUUID());
}

export function makeWebpackCompiler(configuration: Configuration): Compiler;

export function makeWebpackCompiler(configuration: MultiConfiguration): MultiCompiler;

export function makeWebpackCompiler(configuration: Configuration | MultiConfiguration): Compiler | MultiCompiler {
  const compiler = webpack(configuration);

  assert(compiler, 'webpack compiler not defined');

  return compiler;
}

export function makeCompiler(configuration: Configuration): Compiler {
  const compiler = makeWebpackCompiler({
    mode: 'development',
    stats: 'errors-only',
    infrastructureLogging: {
      level: 'none',
      debug: false,
    },
    ...configuration,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compiler.outputFileSystem = createFsFromVolume(new Volume()) as any;

  return compiler;
}

export function makeMultiCompiler(configurations: Configuration[]): MultiCompiler {
  const compiler = makeWebpackCompiler(
    configurations.map(
      (config) =>
        ({
          mode: 'development',
          stats: 'errors-only',
          infrastructureLogging: {
            level: 'none',
            debug: false,
          },
          ...config,
        }) satisfies Configuration,
    ),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compiler.outputFileSystem = createFsFromVolume(new Volume()) as any;

  return compiler;
}

export const makeRun = (compiler: Compiler) => (): Promise<Stats | undefined> =>
  new Promise((resolve, reject) => {
    compiler.run((err, stats) => (err ? reject(err) : resolve(stats)));
  });

export function create(
  configuration: Configuration,
  pluginOptions?: ConstructorParameters<typeof WebpackAssetsManifest>[0],
  comp = makeCompiler,
): {
  compiler: Compiler;
  manifest: WebpackAssetsManifest;
  run: () => Promise<Stats | undefined>;
} {
  const manifest = new WebpackAssetsManifest(pluginOptions);

  const compiler = comp({
    ...configuration,
    plugins: [...(configuration.plugins ?? []), manifest],
  });

  return {
    compiler,
    manifest,
    run: makeRun(compiler),
  };
}

export function createMulti(
  configurations: Configuration[],
  pluginOptions?: ConstructorParameters<typeof WebpackAssetsManifest>[0],
  comp = makeMultiCompiler,
): {
  compiler: MultiCompiler;
  manifest: WebpackAssetsManifest;
  run: () => Promise<MultiStats | undefined>;
} {
  const manifest = new WebpackAssetsManifest(pluginOptions);

  const compiler = comp(
    configurations.map(
      (config) =>
        ({
          mode: 'development',
          stats: 'errors-only',
          infrastructureLogging: {
            level: 'none',
            debug: false,
          },
          ...config,
          plugins: [...(config.plugins ?? []), manifest],
        }) satisfies Configuration,
    ),
  );

  const run = (): Promise<MultiStats | undefined> =>
    new Promise((resolve, reject) => {
      compiler.run((err, stats) => (err ? reject(err) : resolve(stats)));
    });

  return { compiler, manifest, run };
}
