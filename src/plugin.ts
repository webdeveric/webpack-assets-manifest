/**
 * Webpack Assets Manifest
 *
 * @author Eric King <eric@webdeveric.com>
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, normalize, relative, resolve } from 'node:path';

import { validate } from 'schema-utils';
import { AsyncSeriesHook, SyncHook, SyncWaterfallHook } from 'tapable';

import { asArray, findMapKeysByValue, getSortedObject, getSRIHash, group, lock, unlock } from './helpers.js';
import { optionsSchema } from './options-schema.js';
import { isKeyValuePair, isObject } from './type-predicate.js';

import type {
  AssetsStorage,
  AssetsStorageKey,
  AssetsStorageValue,
  JsonStringifyReplacer,
  JsonStringifySpace,
  KeyValuePair,
} from './types.js';
import type {
  Asset,
  Compilation,
  Compiler,
  LoaderContext,
  NormalModule,
  Stats,
  StatsAsset,
  StatsCompilation,
  WebpackPluginInstance,
} from 'webpack';

const PLUGIN_NAME = 'WebpackAssetsManifest';

/**
 * @public
 */
export type Options = {
  /**
   * This is the assets manifest data that gets serialized into JSON.
   */
  assets: AssetsStorage;
  contextRelativeKeys: boolean;
  enabled: boolean;
  entrypoints: boolean;
  entrypointsKey: string | false;
  entrypointsUseAssets: boolean;
  /**
   * Store arbitrary data here for use in customize/transform
   */
  extra: Record<PropertyKey, unknown>;
  fileExtRegex: RegExp | false;
  integrity: boolean;
  integrityHashes: string[];
  /**
   * The `asset.info` property name where the SRI hash is stored.
   */
  integrityPropertyName: string;
  merge: boolean | 'customize';
  output: string;
  publicPath?: ((filename: string, manifest: WebpackAssetsManifest) => string) | string | boolean;
  sortManifest: boolean | ((left: string, right: string) => number);
  writeToDisk: boolean | 'auto';

  // JSON stringify parameters
  replacer: JsonStringifyReplacer;
  space: JsonStringifySpace;

  // Hooks
  apply?: (manifest: WebpackAssetsManifest) => void;
  customize?: (
    entry: KeyValuePair | false | undefined | void,
    original: KeyValuePair,
    manifest: WebpackAssetsManifest,
    asset?: Asset,
  ) => KeyValuePair | false | undefined | void;
  done?: (manifest: WebpackAssetsManifest, stats: Stats) => Promise<void>;
  transform?: (assets: AssetsStorage, manifest: WebpackAssetsManifest) => AssetsStorage;
};

/**
 * @public
 */
export class WebpackAssetsManifest implements WebpackPluginInstance {
  public options: Options;

  public assets: AssetsStorage;

  // original filename : hashed filename
  public assetNames = new Map<string, string>();

  // The Webpack compiler instance
  public compiler?: Compiler;

  // This is passed to the customize() hook
  private currentAsset?: Asset;

  // Is a merge happening?
  #isMerging = false;

  /**
   * This is using hooks from {@link https://github.com/webpack/tapable | Tapable}.
   */
  hooks = Object.freeze({
    apply: new SyncHook<[manifest: WebpackAssetsManifest]>(['manifest']),
    customize: new SyncWaterfallHook<
      [
        entry: KeyValuePair | false | undefined | void,
        original: KeyValuePair,
        manifest: WebpackAssetsManifest,
        asset: Asset | undefined,
      ]
    >(['entry', 'original', 'manifest', 'asset']),
    transform: new SyncWaterfallHook<[asset: AssetsStorage, manifest: WebpackAssetsManifest]>(['assets', 'manifest']),
    done: new AsyncSeriesHook<[manifest: WebpackAssetsManifest, stats: Stats]>(['manifest', 'stats']),
    options: new SyncWaterfallHook<[options: Options]>(['options']),
    afterOptions: new SyncHook<[options: Options, manifest: WebpackAssetsManifest]>(['options', 'manifest']),
  });

  constructor(options: Partial<Options> = {}) {
    this.hooks.transform.tap(PLUGIN_NAME, (assets) => {
      const { sortManifest } = this.options;

      return sortManifest
        ? getSortedObject(assets, typeof sortManifest === 'function' ? sortManifest.bind(this) : undefined)
        : assets;
    });

    this.hooks.afterOptions.tap(PLUGIN_NAME, (options, manifest) => {
      manifest.options = Object.assign(manifest.defaultOptions, options);

      validate(optionsSchema, manifest.options, { name: PLUGIN_NAME });

      manifest.options.output = normalize(manifest.options.output);

      // Copy over any entries that may have been added to the manifest before apply() was called.
      // If the same key exists in assets and options.assets, options.assets should be used.
      manifest.assets = Object.assign(manifest.options.assets, manifest.assets, manifest.options.assets);

      // Tap some hooks
      manifest.options.apply && manifest.hooks.apply.tap(PLUGIN_NAME, manifest.options.apply);
      manifest.options.customize && manifest.hooks.customize.tap(PLUGIN_NAME, manifest.options.customize);
      manifest.options.transform && manifest.hooks.transform.tap(PLUGIN_NAME, manifest.options.transform);
      manifest.options.done && manifest.hooks.done.tapPromise(PLUGIN_NAME, manifest.options.done);
    });

    this.options = Object.assign(this.defaultOptions, options);

    // This is what gets JSON stringified
    this.assets = this.options.assets;
  }

  /**
   * Hook into the Webpack compiler
   */
  public apply(compiler: Compiler): void {
    this.compiler = compiler;

    // Allow hooks to modify options
    this.options = this.hooks.options.call(this.options);

    // Ensure options contain defaults and are valid
    this.hooks.afterOptions.call(this.options, this);

    if (!this.options.enabled) {
      return;
    }

    compiler.hooks.watchRun.tap(PLUGIN_NAME, this.handleWatchRun.bind(this));

    compiler.hooks.compilation.tap(PLUGIN_NAME, this.handleCompilation.bind(this));

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, this.handleThisCompilation.bind(this));

    // Use fs to write the manifest.json to disk if `options.writeToDisk` is true
    compiler.hooks.afterEmit.tapPromise(PLUGIN_NAME, this.handleAfterEmit.bind(this));

    // The compilation has finished
    compiler.hooks.done.tapPromise(PLUGIN_NAME, async (stats) => await this.hooks.done.promise(this, stats));

    // Setup is complete.
    this.hooks.apply.call(this);
  }

  get utils(): {
    isKeyValuePair: typeof isKeyValuePair;
    isObject: typeof isObject;
    getSRIHash: typeof getSRIHash;
  } {
    return {
      isKeyValuePair,
      isObject,
      getSRIHash,
    };
  }

  /**
   * Get the default options.
   */
  get defaultOptions(): Options {
    return {
      enabled: true,
      assets: Object.create(null),
      output: 'assets-manifest.json',
      replacer: null,
      space: 2,
      writeToDisk: 'auto',
      fileExtRegex: /\.\w{2,4}\.(?:map|gz|br)$|\.\w+$/i,
      sortManifest: true,
      merge: false,
      publicPath: undefined,
      contextRelativeKeys: false,

      // Hooks
      apply: undefined, // After setup is complete
      customize: undefined, // Customize each entry in the manifest
      transform: undefined, // Transform the entire manifest
      done: undefined, // Compilation is done and the manifest has been written

      // Include `compilation.entrypoints` in the manifest file
      entrypoints: false,
      entrypointsKey: 'entrypoints',
      entrypointsUseAssets: false,

      // https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity
      integrity: false,
      integrityHashes: ['sha256', 'sha384', 'sha512'],
      integrityPropertyName: 'integrity',

      // Store arbitrary data here for use in customize/transform
      extra: Object.create(null),
    };
  }

  /**
   * Determine if the manifest data is currently being merged.
   */
  get isMerging(): boolean {
    return this.#isMerging;
  }

  /**
   * Get the file extension.
   */
  public getExtension(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return '';
    }

    filename = filename.split(/[?#]/)[0];

    if (this.options.fileExtRegex instanceof RegExp) {
      const ext = filename.match(this.options.fileExtRegex);

      return ext && ext.length ? ext[0] : '';
    }

    return extname(filename);
  }

  /**
   * Replace backslash with forward slash.
   */
  public fixKey(key: AssetsStorageKey): AssetsStorageKey {
    return typeof key === 'string' ? key.replace(/\\/g, '/') : key;
  }

  /**
   * Add item to assets without modifying the key or value.
   */
  public setRaw(key: AssetsStorageKey, value: AssetsStorageValue): this {
    this.assets[key] = value;

    return this;
  }

  /**
   * Add an item to the manifest.
   */
  public set(key: AssetsStorageKey, value: AssetsStorageValue): this {
    if (this.isMerging && this.options.merge !== 'customize') {
      // Do not fix the key if merging since it should already be correct.
      return this.setRaw(key, value);
    }

    const fixedKey = this.fixKey(key);
    const publicPath = typeof value === 'string' ? this.getPublicPath(value) : value;

    const entry = this.hooks.customize.call(
      {
        key: fixedKey,
        value: publicPath,
      },
      {
        key,
        value,
      },
      this,
      this.currentAsset,
    );

    // Allow the entry to be skipped
    if (entry === false) {
      return this;
    }

    // Use the customized values
    if (isKeyValuePair(entry)) {
      let { key = fixedKey, value = publicPath } = entry;

      // If the integrity should be returned but the entry value was
      // not customized lets do that now so it includes both.
      if (value === publicPath && this.options.integrity) {
        value = {
          src: value,
          integrity: this.currentAsset?.info[this.options.integrityPropertyName] ?? '',
        };
      }

      return this.setRaw(key, value);
    }

    // If the `customize()` hook returns `undefined`, then lets use the initial key/value.
    return this.setRaw(fixedKey, publicPath);
  }

  /**
   * Determine if an item exist in the manifest.
   */
  public has(key: AssetsStorageKey): boolean {
    return Object.hasOwn(this.assets, key) || Object.hasOwn(this.assets, this.fixKey(key));
  }

  /**
   * Get an item from the manifest.
   */
  public get(key: AssetsStorageKey, defaultValue?: AssetsStorageValue): AssetsStorageValue | undefined {
    return this.assets[key] || this.assets[this.fixKey(key)] || defaultValue;
  }

  /**
   * Delete an item from the manifest.
   */
  public delete(key: AssetsStorageKey): boolean {
    if (Object.hasOwn(this.assets, key)) {
      return delete this.assets[key];
    }

    key = this.fixKey(key);

    if (Object.hasOwn(this.assets, key)) {
      return delete this.assets[key];
    }

    return false;
  }

  /**
   * Process compilation assets.
   *
   * TODO: make this `private`
   */
  public processAssetsByChunkName(assets: StatsCompilation['assetsByChunkName'], hmrFiles: Set<string>): void {
    if (assets) {
      Object.keys(assets).forEach((chunkName) => {
        asArray(assets[chunkName])
          .filter((filename) => !hmrFiles.has(filename)) // Remove hot module replacement files
          .forEach((filename) => {
            this.assetNames.set(chunkName + this.getExtension(filename), filename);
          });
      });
    }
  }

  /**
   * Get the data for `JSON.stringify()`.
   */
  public toJSON(): AssetsStorage {
    // This is the last chance to modify the data before the manifest file gets created.
    return this.hooks.transform.call(this.assets, this);
  }

  /**
   * `JSON.stringify()` the manifest.
   */
  public toString(): string {
    return (
      // TODO: replace this once TS handles `Parameters` from overloaded functions better.
      (typeof this.options.replacer === 'function'
        ? JSON.stringify(this, this.options.replacer, this.options.space)
        : JSON.stringify(this, this.options.replacer, this.options.space)) || '{}'
    );
  }

  /**
   * Merge data if the output file already exists
   */
  private async maybeMerge(): Promise<void> {
    if (this.options.merge) {
      try {
        const deepmerge = (await import('deepmerge')).default;

        this.#isMerging = true;

        const content = await readFile(this.getOutputPath(), { encoding: 'utf8' });

        const data = JSON.parse(content);

        const arrayMerge = (_destArray: unknown[], srcArray: unknown[]): typeof srcArray => srcArray;

        for (const [key, oldValue] of Object.entries(data)) {
          if (this.has(key)) {
            const currentValue = this.get(key);

            if (isObject(oldValue) && isObject(currentValue)) {
              const newValue = deepmerge(oldValue, currentValue, { arrayMerge });

              this.set(key, newValue);
            }
          } else {
            this.set(key, oldValue);
          }
        }
      } finally {
        this.#isMerging = false;
      }
    }
  }

  /**
   * Emit the assets manifest
   */
  private async emitAssetsManifest(compilation: Compilation): Promise<void> {
    const outputPath = this.getOutputPath();

    const output = this.getManifestPath(
      compilation,
      this.inDevServer() ? basename(this.options.output) : relative(compilation.compiler.outputPath, outputPath),
    );

    if (this.options.merge) {
      await lock(outputPath);
    }

    await this.maybeMerge();

    compilation.emitAsset(output, new compilation.compiler.webpack.sources.RawSource(this.toString(), false), {
      assetsManifest: true,
      generated: true,
      generatedBy: [PLUGIN_NAME],
    });

    if (this.options.merge) {
      await unlock(outputPath);
    }
  }

  /**
   * Record details of Asset Modules
   */
  private handleProcessAssetsAnalyse(compilation: Compilation /* , assets */): void {
    const { contextRelativeKeys } = this.options;
    const { assetsInfo, chunkGraph, chunks, compiler, codeGenerationResults } = compilation;

    for (const chunk of chunks) {
      const modules = chunkGraph.getChunkModulesIterableBySourceType(chunk, 'asset');

      if (modules) {
        const { NormalModule } = compilation.compiler.webpack;

        for (const module of modules) {
          if (module instanceof NormalModule) {
            const codeGenData = codeGenerationResults.get(module, chunk.runtime).data;

            const { assetInfo = codeGenData?.get('assetInfo'), filename = codeGenData?.get('filename') } =
              module.buildInfo ?? {};

            const info = Object.assign(
              {
                rawRequest: module.rawRequest,
                sourceFilename: relative(compiler.context, module.userRequest),
              },
              assetInfo,
            );

            assetsInfo.set(filename, info);

            this.assetNames.set(
              contextRelativeKeys ? info.sourceFilename : join(dirname(filename), basename(module.userRequest)),
              filename,
            );
          } else {
            compilation.getLogger(PLUGIN_NAME).warn(`Unhandled module: ${module.constructor.name}`);
          }
        }
      }
    }
  }

  /**
   * When using webpack 5 persistent cache, loaderContext.emitFile sometimes doesn't
   * get called and so the asset names are not recorded. To work around this, lets
   * loops over the stats.assets and record the asset names.
   */
  private processStatsAssets(assets: StatsAsset[] | undefined): void {
    const { contextRelativeKeys } = this.options;

    assets?.forEach((asset) => {
      if (asset.name && asset.info.sourceFilename) {
        this.assetNames.set(
          contextRelativeKeys
            ? asset.info.sourceFilename
            : join(dirname(asset.name), basename(asset.info.sourceFilename)),
          asset.name,
        );
      }
    });
  }

  /**
   * Get assets and hot module replacement files from a compilation object.
   */
  private getCompilationAssets(compilation: Compilation): {
    assets: Asset[];
    hmrFiles: Set<string>;
  } {
    const hmrFiles = new Set<string>();

    const assets = compilation.getAssets().filter((asset) => {
      if (asset.info.hotModuleReplacement) {
        hmrFiles.add(asset.name);

        return false;
      }

      return !asset.info.assetsManifest;
    });

    return {
      assets,
      hmrFiles,
    };
  }

  /**
   * Gather asset details.
   */
  private async handleProcessAssetsReport(compilation: Compilation): Promise<void> {
    // Look in DefaultStatsPresetPlugin.js for options
    const stats = compilation.getStats().toJson({
      all: false,
      assets: true,
      cachedAssets: true,
      cachedModules: true,
      chunkGroups: this.options.entrypoints,
      chunkGroupChildren: this.options.entrypoints,
    });

    const { assets, hmrFiles } = this.getCompilationAssets(compilation);

    this.processStatsAssets(stats.assets);

    this.processAssetsByChunkName(stats.assetsByChunkName, hmrFiles);

    const findAssetKeys = findMapKeysByValue(this.assetNames);

    const { contextRelativeKeys } = this.options;

    for (const asset of assets) {
      const sourceFilenames = findAssetKeys(asset.name);

      if (!sourceFilenames.length) {
        const { sourceFilename } = asset.info;
        const name = sourceFilename ? (contextRelativeKeys ? sourceFilename : basename(sourceFilename)) : asset.name;

        sourceFilenames.push(name);
      }

      sourceFilenames.forEach((key) => {
        this.currentAsset = asset;

        this.set(key, asset.name);

        this.currentAsset = undefined;
      });
    }

    if (this.options.entrypoints) {
      const removeHMR = (file: string): boolean => !hmrFiles.has(file);
      const getExtensionGroup = (file: string): string => this.getExtension(file).substring(1).toLowerCase();
      const getAssetOrFilename = (file: string): AssetsStorage[keyof AssetsStorage] | string => {
        let asset: AssetsStorage[keyof AssetsStorage] | undefined;

        if (this.options.entrypointsUseAssets) {
          const firstAssetKey = findAssetKeys(file).pop();

          asset = firstAssetKey ? this.assets[firstAssetKey] || this.assets[file] : this.assets[file];
        }

        return asset ? asset : this.getPublicPath(file);
      };

      const entrypoints = Object.fromEntries(
        Array.from(compilation.entrypoints, ([name, entrypoint]) => {
          const value: Record<PropertyKey, Record<PropertyKey, string[]>> = {
            assets: group(entrypoint.getFiles().filter(removeHMR), getExtensionGroup, getAssetOrFilename),
          };

          // This contains preload and prefetch
          const childAssets = stats.namedChunkGroups?.[name].childAssets;

          if (childAssets) {
            for (const [property, assets] of Object.entries(childAssets)) {
              value[property] = group(assets.filter(removeHMR), getExtensionGroup, getAssetOrFilename);
            }
          }

          return [name, value];
        }),
      );

      if (this.options.entrypointsKey === false) {
        for (const key in entrypoints) {
          this.setRaw(key, entrypoints[key]);
        }
      } else {
        this.setRaw(this.options.entrypointsKey, {
          ...this.get(this.options.entrypointsKey),
          ...entrypoints,
        });
      }
    }

    await this.emitAssetsManifest(compilation);
  }

  /**
   * Get assets manifest file path.
   */
  private getManifestPath(compilation: Compilation, filename: string): string {
    return compilation.getPath(filename, {
      chunk: {
        name: 'assets-manifest',
        id: '',
        hash: '',
      },
      filename: 'assets-manifest.json',
    });
  }

  /**
   * Write the asset manifest to the file system.
   */
  public async writeTo(destination: string): Promise<void> {
    await lock(destination);

    await mkdir(dirname(destination), { recursive: true });

    await writeFile(destination, this.toString());

    await unlock(destination);
  }

  public clear(): void {
    // Delete properties instead of setting to {} so that the variable reference
    // is maintained incase the `assets` is being shared in multi-compiler mode.
    Object.keys(this.assets).forEach((key) => {
      delete this.assets[key];
    });
  }

  /**
   * Cleanup before running Webpack
   */
  private handleWatchRun(): void {
    this.clear();
  }

  /**
   * Determine if the manifest should be written to disk with fs.
   *
   * TODO: make this `private`
   */
  public shouldWriteToDisk(compilation: Compilation): boolean {
    if (this.options.writeToDisk === 'auto') {
      // Check to see if we let webpack-dev-server handle it.
      if (this.inDevServer()) {
        const wdsWriteToDisk: ((filePath: string) => boolean) | boolean | undefined = compilation.options.devServer
          ? (compilation.options.devServer.devMiddleware?.writeToDisk ?? compilation.options.devServer.writeToDisk)
          : undefined;

        if (wdsWriteToDisk === true) {
          return false;
        }

        const manifestPath = this.getManifestPath(compilation, this.getOutputPath());

        if (typeof wdsWriteToDisk === 'function' && wdsWriteToDisk(manifestPath) === true) {
          return false;
        }

        if (this.compiler?.outputPath) {
          // Return true if the manifest output is above the compiler outputPath.
          return relative(this.compiler.outputPath, manifestPath).startsWith('..');
        }
      }

      return false;
    }

    return this.options.writeToDisk;
  }

  /**
   * Last chance to write the manifest to disk.
   */
  private async handleAfterEmit(compilation: Compilation): Promise<void> {
    if (this.shouldWriteToDisk(compilation)) {
      await this.writeTo(this.getManifestPath(compilation, this.getOutputPath()));
    }
  }

  /**
   * Record asset names
   */
  private handleNormalModuleLoader(compilation: Compilation, loaderContext: object, module: NormalModule): void {
    const emitFile = (loaderContext as LoaderContext<unknown>).emitFile.bind(module);

    const { contextRelativeKeys } = this.options;

    // assetInfo parameter was added in Webpack 4.40.0
    (loaderContext as LoaderContext<unknown>).emitFile = (name, content, sourceMap, assetInfo) => {
      const info = Object.assign(
        {
          rawRequest: module.rawRequest,
          sourceFilename: relative(compilation.compiler.context, module.userRequest),
        },
        assetInfo,
      );

      this.assetNames.set(
        contextRelativeKeys ? info.sourceFilename : join(dirname(name), basename(module.userRequest)),
        name,
      );

      emitFile(name, content, sourceMap, info);
    };
  }

  /**
   * Add the SRI hash to the assetsInfo map
   */
  private recordSubresourceIntegrity(compilation: Compilation): void {
    const { integrityHashes, integrityPropertyName } = this.options;

    for (const asset of compilation.getAssets()) {
      if (!asset.info[integrityPropertyName]) {
        const sriHashes = new Map<string, string | undefined>(
          integrityHashes.map((algorithm) => [algorithm, undefined]),
        );

        // webpack-subresource-integrity@4+ stores the integrity hash on `asset.info.contenthash`.
        if (asset.info.contenthash) {
          asArray(asset.info.contenthash)
            .filter((contentHash) => integrityHashes.some((algorithm) => contentHash.startsWith(`${algorithm}-`)))
            .forEach((sriHash) => sriHashes.set(sriHash.substring(0, sriHash.indexOf('-')), sriHash));
        }

        const assetContent = asset.source.source().toString();

        sriHashes.forEach((value, key, map) => {
          if (typeof value === 'undefined') {
            map.set(key, getSRIHash(key, assetContent));
          }
        });

        asset.info[integrityPropertyName] = Array.from(sriHashes.values()).join(' ');

        compilation.assetsInfo.set(asset.name, asset.info);
      }
    }
  }

  /**
   * Hook into compilation objects
   */
  private handleCompilation(compilation: Compilation): void {
    compilation.compiler.webpack.NormalModule.getCompilationHooks(compilation).loader.tap(
      PLUGIN_NAME,
      this.handleNormalModuleLoader.bind(this, compilation),
    );

    compilation.hooks.processAssets.tap(
      {
        name: PLUGIN_NAME,
        stage: compilation.compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ANALYSE,
      },
      this.handleProcessAssetsAnalyse.bind(this, compilation),
    );
  }

  /**
   * Hook into the compilation object
   */
  private handleThisCompilation(compilation: Compilation): void {
    if (this.options.integrity) {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: compilation.compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ANALYSE,
        },
        this.recordSubresourceIntegrity.bind(this, compilation),
      );
    }

    compilation.hooks.processAssets.tapPromise(
      {
        name: PLUGIN_NAME,
        stage: compilation.compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
      },
      this.handleProcessAssetsReport.bind(this, compilation),
    );
  }

  /**
   * Determine if webpack-dev-server is being used
   *
   * The WEBPACK_DEV_SERVER / WEBPACK_SERVE env vars cannot be relied upon.
   * See issue {@link https://github.com/webdeveric/webpack-assets-manifest/issues/125}
   */
  public inDevServer(): boolean {
    const [, webpackPath, serve] = process.argv;

    if (serve === 'serve' && webpackPath && basename(webpackPath) === 'webpack') {
      return true;
    }

    if (process.argv.some((arg) => arg.includes('webpack-dev-server'))) {
      return true;
    }

    return (
      isObject(this.compiler?.outputFileSystem) &&
      // `memfs@4` package defines `fs.__vol`.
      ('__vol' in this.compiler.outputFileSystem ||
        // webpack initially sets `compiler.outputFileSystem` and `compiler.intermediateFileSystem` to the same `graceful-fs` object.
        // webpack-dev-middleware changes only the `outputFileSystem` so lets check if they are still the same.
        !Object.is(this.compiler.outputFileSystem, this.compiler.intermediateFileSystem))
    );
  }

  /**
   * Get the file system path to the manifest
   */
  public getOutputPath(): string {
    return isAbsolute(this.options.output)
      ? this.options.output
      : this.compiler
        ? resolve(this.compiler.outputPath, this.options.output)
        : '';
  }

  /**
   * Get the public path for the filename
   */
  public getPublicPath(filename: string): string {
    const { publicPath } = this.options;

    if (typeof publicPath === 'function') {
      return publicPath(filename, this);
    }

    if (publicPath) {
      const resolvePath = (filename: string, base: string): string => {
        try {
          return new URL(filename, base).toString();
        } catch {
          return base + filename;
        }
      };

      if (typeof publicPath === 'string') {
        return resolvePath(filename, publicPath);
      }

      const compilerPublicPath = this.compiler?.options.output.publicPath;

      if (typeof compilerPublicPath === 'string' && compilerPublicPath !== 'auto') {
        return resolvePath(filename, compilerPublicPath);
      }
    }

    return filename;
  }

  /**
   * Get a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler} for the manifest.
   * This allows you to use `[]` to manage entries.
   */
  public getProxy(raw = false): this & {
    [key: AssetsStorageKey]: AssetsStorageValue;
  } {
    const setMethod = raw ? 'setRaw' : 'set';

    return new Proxy(this, {
      has(target, property: string) {
        return target.has(property);
      },
      get(target, property: string) {
        return target.get(property);
      },
      set(target, property: string, value: AssetsStorageValue) {
        return target[setMethod](property, value).has(property);
      },
      deleteProperty(target, property: string) {
        return target.delete(property);
      },
    });
  }
}
