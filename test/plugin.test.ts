/* eslint-disable @typescript-eslint/naming-convention */
import { chmod, copyFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { rimraf } from 'rimraf';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { container, webpack, type Compilation } from 'webpack';
import { version as webpackVersion } from 'webpack/package.json';
import WebpackDevServer from 'webpack-dev-server';
import { version as webpackDevServerVersion } from 'webpack-dev-server/package.json';

import { WebpackAssetsManifest, type Options } from '../src/plugin.js';
import { isObject } from '../src/type-predicate.js';

import { create, createMulti, getWorkspace, makeCompiler, makeRun } from './utils.js';
import * as configs from './webpack-configs.js';

import type { AssetsStorage, JsonStringifySpace, KeyValuePair } from '../src/types.js';

const currentDirectory = fileURLToPath(new URL('.', import.meta.url));

console.log(`webpack version: ${webpackVersion}\nwebpack dev server version: ${webpackDevServerVersion}`);

const _444 = 0o444;
const _777 = 0o777;

it('Is a webpack plugin', () => {
  const manifest = new WebpackAssetsManifest();

  expect(typeof manifest.apply).toEqual('function');
});

describe('Methods', () => {
  describe('getExtension()', () => {
    const manifest = new WebpackAssetsManifest();

    it('Should return the file extension', () => {
      expect(manifest.getExtension('main.css')).toEqual('.css');
    });

    it.each([
      { input: 'main.js.map', output: '.js.map' },
      { input: 'main.css.map', output: '.css.map' },
      { input: 'archive.tar.gz', output: '.tar.gz' },
      { input: 'some.unknown.ext', output: '.ext' },
    ])('Should return two extensions for known formats ($input => $output)', function ({ input, output }) {
      expect(manifest.getExtension(input)).toEqual(output);
    });

    it('Should return empty string when filename is undefined or empty', () => {
      expect(manifest.getExtension('')).toEqual('');
      expect(manifest.getExtension(undefined as unknown as string)).toEqual('');
    });

    it('Should return empty string when filename does not have an extension', () => {
      expect(manifest.getExtension('no-extension')).toEqual('');
    });

    it('Should ignore query string and fragment', () => {
      expect(manifest.getExtension('main.js?a=1')).toEqual('.js');
      expect(manifest.getExtension('main.js#b')).toEqual('.js');
      expect(manifest.getExtension('main.js?a=1#b')).toEqual('.js');
    });
  });

  describe('toJSON()', () => {
    const manifest = new WebpackAssetsManifest();

    it('Should return an object', () => {
      expect(manifest.toJSON()).toEqual({});
      expect(JSON.stringify(manifest)).toEqual('{}');
    });
  });

  describe('toString()', () => {
    it('Should return a JSON string', () => {
      const manifest = new WebpackAssetsManifest();

      manifest.hooks.afterOptions.call(manifest.options, manifest);

      expect(manifest.toString()).toEqual('{}');
      expect(manifest + '').toEqual('{}');
      expect(`${manifest}`).toEqual('{}');
    });

    it('can use tabs', () => {
      const manifest = new WebpackAssetsManifest({
        space: '\t',
      });

      manifest.hooks.afterOptions.call(manifest.options, manifest);

      manifest.set('test', 'test');

      expect(manifest.toString()).toEqual('{\n\t"test": "test"\n}');
    });
  });

  describe('getOutputPath()', () => {
    it('Should work with an absolute output path', () => {
      const { manifest } = create(configs.hello(), {
        output: '/manifest.json',
      });

      expect(manifest.getOutputPath()).toEqual('/manifest.json');
    });

    it('Should work with a relative output path', () => {
      const { compiler, manifest } = create(configs.hello(), {
        output: '../manifest.json',
      });

      expect(manifest.getOutputPath()).toEqual(resolve(String(compiler.options.output.path), '../manifest.json'));
    });

    it('Should output manifest in compiler output.path by default', () => {
      const { compiler, manifest } = create(configs.hello());

      expect(dirname(manifest.getOutputPath())).toEqual(compiler.options.output.path);
    });

    it('Should return an empty string if manifest has not been applied yet', () => {
      const manifest = new WebpackAssetsManifest();

      expect(manifest.getOutputPath()).toEqual('');
    });
  });

  describe('getPublicPath()', () => {
    it('Returns the public path', async () => {
      const { manifest, run } = create(
        {
          entry: {
            hello: resolve(currentDirectory, './fixtures/hello.js'),
          },
          output: {
            clean: true,
            path: resolve(currentDirectory, './fixtures/dist'),
            publicPath: 'https://example.com/',
          },
        },
        {
          publicPath: true,
        },
      );

      await run();

      expect(manifest.get('hello.js')).toEqual('https://example.com/hello.js');
    });
  });

  describe('fixKey()', () => {
    it('Should replace \\ with /', () => {
      const manifest = new WebpackAssetsManifest();

      expect(manifest.fixKey('images\\Ginger.jpg')).toEqual('images/Ginger.jpg');
    });

    it('Should return the key if not a string', () => {
      const manifest = new WebpackAssetsManifest();

      expect(manifest.fixKey(1)).toEqual(1);
    });
  });

  describe('set()', () => {
    it('Should add to manifest.assets', () => {
      const manifest = new WebpackAssetsManifest();

      expect(manifest.assets).toEqual({});

      manifest.set('main.js', 'main.123456.js');
      manifest.set('styles/main.css', 'styles/main.123456.css');

      expect(manifest.assets).toEqual({
        'main.js': 'main.123456.js',
        'styles/main.css': 'styles/main.123456.css',
      });
    });

    it('Should transform backslashes to slashes', () => {
      const manifest = new WebpackAssetsManifest();

      manifest.set('images\\a.jpg', 'images/a.123456.jpg');

      expect(manifest.assets).toEqual({
        'images/a.jpg': 'images/a.123456.jpg',
      });
    });
  });

  describe('setRaw()', () => {
    it('Uses keys without fixing them', () => {
      const manifest = new WebpackAssetsManifest();

      manifest.setRaw('\\\\', 'image.jpg');

      expect(manifest.has('\\\\')).toBeTruthy();
      expect(manifest.get('\\\\')).toEqual('image.jpg');
    });
  });

  describe('has()', () => {
    it('Should return a boolean', async () => {
      const images = (await import('./fixtures/json/images.json')).default;

      const manifest = new WebpackAssetsManifest({
        assets: Object.assign({}, images),
      });

      expect(manifest.has('Ginger.jpg')).toBeTruthy();
      expect(manifest.has('dog.gif')).toBeFalsy();
    });
  });

  describe('get()', async () => {
    const images = (await import('./fixtures/json/images.json')).default;

    const manifest = new WebpackAssetsManifest({
      assets: Object.assign({}, images),
    });

    it('gets a value from the manifest', () => {
      expect(manifest.get('Ginger.jpg')).toEqual('images/Ginger.jpg');
    });

    it('returns a default value', () => {
      const defaultValue = 'some/default.gif';

      expect(manifest.get('dog.gif', defaultValue)).toEqual(defaultValue);
    });

    it('returns undefined when no default value is provided', () => {
      expect(manifest.get('dog.gif')).toBeUndefined();
    });
  });

  describe('delete()', () => {
    it('removes an asset from the manifest', () => {
      const manifest = new WebpackAssetsManifest();
      const methods = ['set', 'setRaw'] satisfies (keyof WebpackAssetsManifest)[];

      ['some/image.jpg', 'some\\image.jpg'].forEach(key => {
        methods.forEach(method => {
          manifest[method](key, 'image.jpg');

          expect(manifest.has(key)).toBeTruthy();

          manifest.delete(key);

          expect(manifest.has(key)).toBeFalsy();
        });
      });

      expect(manifest.delete('404.js')).toBeFalsy();
    });
  });

  describe('inDevServer()', () => {
    let originalArgv: (typeof process)['argv'];

    beforeEach(() => {
      originalArgv = process.argv.slice(0);
    });

    afterEach(() => {
      process.argv = originalArgv;
    });

    it('Identifies `webpack serve` from argv', () => {
      const manifest = new WebpackAssetsManifest();

      expect(manifest.inDevServer()).toBeFalsy();

      process.argv = [originalArgv[0], join(dirname(originalArgv[1]), 'webpack'), 'serve'];

      expect(manifest.inDevServer()).toBeTruthy();
    });

    it('Identifies webpack-dev-server from argv', () => {
      const manifest = new WebpackAssetsManifest();

      expect(manifest.inDevServer()).toBeFalsy();

      process.argv.push('webpack-dev-server');

      expect(manifest.inDevServer()).toBeTruthy();
    });

    it('Identifies webpack-dev-server from outputFileSystem (memfs)', () => {
      const { manifest } = create(configs.hello());

      expect(manifest.inDevServer()).toBeTruthy();
    });

    it('Works correctly when outputFileSystem.prototype is null', () => {
      const { compiler, manifest } = create(configs.hello(), undefined, webpack);

      Object.setPrototypeOf(compiler.outputFileSystem, null);

      manifest.apply(compiler);

      expect(manifest.inDevServer()).toBeFalsy();
    });
  });

  describe('getProxy()', () => {
    it('Returns a Proxy', () => {
      const manifest = new WebpackAssetsManifest();

      [undefined, false, true].forEach(raw => {
        const proxy = manifest.getProxy(raw);

        expect(proxy).instanceOf(WebpackAssetsManifest);

        proxy['test'] = 'test';

        expect('test' in proxy).toBeTruthy();
        expect(proxy['test']).toEqual('test');

        delete proxy['test'];

        expect(proxy['test']).toBeUndefined();
        expect('test' in proxy).toBeFalsy();
      });
    });
  });

  describe('clear()', () => {
    it('Clears data', async () => {
      const { manifest, run } = create(configs.hello());

      expect(Object.keys(manifest.assets)).toHaveLength(0);

      await run();

      expect(Object.keys(manifest.assets)).toHaveLength(1);

      manifest.clear();

      expect(Object.keys(manifest.assets)).toHaveLength(0);
    });
  });
});

describe('Options', () => {
  describe('enabled', () => {
    it('does nothing if not enabled', async () => {
      const { manifest, run } = create(configs.hello(), {
        enabled: false,
      });

      await run();

      expect(Object.keys(manifest.assets)).toHaveLength(0);
    });
  });

  describe('sortManifest', () => {
    const assets = {
      'd.js': 'd.js',
      'c.js': 'c.js',
      'b.js': 'b.js',
      'a.js': 'a.js',
    };

    it('Should turn on sorting', () => {
      const manifest = new WebpackAssetsManifest({
        assets,
        sortManifest: true,
        space: 0,
      });

      expect(manifest.toString()).toEqual('{"a.js":"a.js","b.js":"b.js","c.js":"c.js","d.js":"d.js"}');
    });

    it('Should turn off sorting', () => {
      const manifest = new WebpackAssetsManifest({
        assets,
        sortManifest: false,
        space: 0,
      });

      expect(manifest.toString()).toEqual('{"d.js":"d.js","c.js":"c.js","b.js":"b.js","a.js":"a.js"}');
    });

    it('Should use custom comparison function', () => {
      const manifest = new WebpackAssetsManifest({
        assets,
        sortManifest: function (left, right) {
          return left.localeCompare(right);
        },
        space: 0,
      });

      expect(manifest.toString()).toEqual('{"a.js":"a.js","b.js":"b.js","c.js":"c.js","d.js":"d.js"}');
    });
  });

  describe('fileExtRegex', () => {
    it('Should use custom RegExp', () => {
      const manifest = new WebpackAssetsManifest({
        fileExtRegex: /\.[A-Z]+$/,
      });

      expect(manifest.getExtension('test.JS')).toEqual('.JS');
      expect(manifest.getExtension('test.JS.map')).toEqual('');
    });

    it('Should fallback to path.extname', () => {
      const manifest = new WebpackAssetsManifest({
        fileExtRegex: false,
      });

      expect(manifest.getExtension('test.js')).toEqual('.js');
      expect(manifest.getExtension('test.js.map')).toEqual('.map');
    });
  });

  describe('replacer', () => {
    const assets = {
      'logo.svg': 'images/logo.svg',
    };

    it('Should remove all entries', () => {
      const manifest = new WebpackAssetsManifest({
        assets,
        replacer: () => undefined,
      });

      expect(manifest.toString()).toEqual('{}');
    });

    it('Should update values', () => {
      const manifest = new WebpackAssetsManifest({
        assets,
        space: 0,
        replacer: function (_key, value) {
          if (typeof value === 'string') {
            return value.toUpperCase();
          }

          return value;
        },
      });

      expect(manifest.toString()).toEqual('{"logo.svg":"IMAGES/LOGO.SVG"}');
    });
  });

  describe('assets', () => {
    const assets: AssetsStorage = {
      'logo.svg': 'images/logo.svg',
    };

    it('Should set the initial assets data', async () => {
      const images = (await import('./fixtures/json/images.json')).default;

      const manifest = new WebpackAssetsManifest({
        assets: Object.assign({}, images),
        space: 0,
      });

      Object.keys(assets).forEach(key => {
        manifest.set(key, assets[key]);
      });

      expect(manifest.toString()).toEqual('{"Ginger.jpg":"images/Ginger.jpg","logo.svg":"images/logo.svg"}');
    });

    it('Should be sharable', () => {
      const sharedAssets = Object.create(null);

      const { manifest: manifest1 } = create(configs.hello(), {
        assets: sharedAssets,
      });

      const { manifest: manifest2 } = create(configs.client(), {
        assets: sharedAssets,
      });

      manifest1.set('main.js', 'main.js');
      manifest2.set('subpage.js', 'subpage.js');

      expect(manifest1.toString()).toEqual(manifest2.toString());
    });
  });

  describe.sequential('merge', () => {
    beforeAll(async () => {
      await mkdir(getWorkspace(), { recursive: true, mode: _777 });
    });

    afterAll(async () => {
      await rimraf(getWorkspace());
    });

    async function setupManifest(
      manifest: WebpackAssetsManifest,
      jsonFilePath: string,
    ): Promise<WebpackAssetsManifest> {
      await mkdir(dirname(manifest.getOutputPath()), { recursive: true, mode: _777 });

      await copyFile(resolve(currentDirectory, jsonFilePath), manifest.getOutputPath());

      return manifest;
    }

    it('Should merge data if output file exists', async () => {
      const { manifest, run } = create(configs.hello(), {
        entrypoints: true,
        merge: true,
        space: 0,
      });

      await setupManifest(manifest, 'fixtures/json/sample-manifest.json');
      await run();

      expect(manifest.toString()).toEqual(
        '{"Ginger.jpg":"images/Ginger.jpg","entrypoints":{"main":{"assets":{"css":["main.css"],"js":["main.js"]}},"demo":{"assets":{"js":["demo.js"]}}},"main.js":"main.js"}',
      );
    });

    it('Can customize during merge', async () => {
      const mergingResults: boolean[] = [];
      const { manifest, run } = create(configs.hello(), {
        merge: 'customize',
        space: 0,
        customize(_entry, _original, manifest) {
          mergingResults.push(manifest.isMerging);
        },
      });

      await setupManifest(manifest, 'fixtures/json/sample-manifest.json');

      await run();

      expect(mergingResults).toEqual([false, true, true]);
    });

    it('"merge: true" skips customize()', async () => {
      const mock = vi.fn();

      const { manifest, run } = create(configs.hello(), {
        merge: true,
        customize(_entry, _original, manifest) {
          if (manifest.isMerging) {
            mock();
          }
        },
      });

      await setupManifest(manifest, 'fixtures/json/sample-manifest.json');
      await run();

      expect(mock).not.toHaveBeenCalled();
    });

    it('Invalid JSON data throws an Error', async () => {
      const { manifest, run } = create(configs.hello(), {
        merge: true,
      });

      await setupManifest(manifest, 'fixtures/json/invalid-json.txt');

      await expect(run()).rejects.toThrowError();
    });
  });

  describe('publicPath', () => {
    const img = 'images/photo.jpg';
    const cdn = {
      default: 'https://cdn.example.com/',
      images: 'https://img-cdn.example.com/',
    };

    it('Can be a string', () => {
      const manifest = new WebpackAssetsManifest({
        publicPath: 'assets/',
      });

      manifest.set('hello', 'world');

      expect(manifest.get('hello')).toEqual('assets/world');
    });

    it('Can be true', async () => {
      const config = configs.hello();

      config.output.publicPath = cdn.default;

      const { manifest, run } = create(config, {
        publicPath: true,
      });

      await run();

      expect(manifest.get('main.js')).toEqual(cdn.default + 'main.js');
    });

    it('Has no effect if false', async () => {
      const config = configs.hello();

      config.output.publicPath = cdn.default;

      const { manifest, run } = create(config, {
        publicPath: false,
      });

      await run();

      expect(manifest.get('main.js')).toEqual('main.js');
    });

    it('Only prefixes strings', () => {
      const manifest = new WebpackAssetsManifest({
        publicPath: cdn.default,
      });

      manifest.set('obj', {});

      expect(manifest.get('obj')).toEqual({});
    });

    it('Can be a custom function', () => {
      const manifest = new WebpackAssetsManifest({
        publicPath: (value, manifest) => {
          if (manifest.getExtension(value).substring(1).toLowerCase()) {
            return cdn.images + value;
          }

          return cdn.default + value;
        },
      });

      expect(manifest.options.publicPath).instanceOf(Function);

      manifest.set(img, img);

      expect(manifest.get(img)).toEqual(cdn.images + img);
    });
  });

  describe('customize', () => {
    it('Customizes the key and value', () => {
      const { manifest } = create(configs.hello(), {
        customize(entry, _original, manifest) {
          return manifest.utils.isKeyValuePair(entry)
            ? {
                key: String(entry.key).toUpperCase(),
                value: entry.value.toUpperCase(),
              }
            : entry;
        },
      });

      manifest.set('hello', 'world');

      expect(manifest.has('HELLO')).toBeTruthy();
      expect(manifest.has('hello')).toBeFalsy();
    });

    it('Customizes the key', () => {
      const { manifest } = create(configs.hello(), {
        customize(entry, _original, manifest) {
          return manifest.utils.isKeyValuePair(entry)
            ? {
                key: String(entry.key).toUpperCase(),
              }
            : entry;
        },
      });

      manifest.set('hello', 'world');

      expect(manifest.has('HELLO')).toBeTruthy();
      expect(manifest.has('hello')).toBeFalsy();
      expect(manifest.get('HELLO')).toEqual('world');
    });

    it('Customizes the value', () => {
      const { manifest } = create(configs.hello(), {
        customize(entry, _original, manifest) {
          return manifest.utils.isKeyValuePair(entry)
            ? {
                value: String(entry.value).toUpperCase(),
              }
            : entry;
        },
      });

      manifest.set('hello', 'world');

      expect(manifest.has('HELLO')).toBeFalsy();
      expect(manifest.has('hello')).toBeTruthy();
      expect(manifest.get('hello')).toEqual('WORLD');
    });

    it('Has no effect unless a KeyValuePair or false is returned', () => {
      const { manifest } = create(configs.hello(), {
        customize() {
          return {} as KeyValuePair;
        },
      });

      manifest.set('hello', 'world');

      expect(manifest.has('hello')).toBeTruthy();
      expect(manifest.get('hello')).toEqual('world');
    });

    it('Skips adding asset if false is returned', () => {
      const { manifest } = create(configs.hello(), {
        customize() {
          return false;
        },
      });

      manifest.set('hello', 'world');

      expect(manifest.has('hello')).toBeFalsy();

      expect(Object.keys(manifest.assets)).toHaveLength(0);
    });
  });

  describe('integrityHashes', () => {
    it('Invalid crypto hashes throw an Error', () => {
      expect(() => {
        create(configs.hello(), {
          integrityHashes: ['sha256', 'invalid-algorithm'],
        });
      }).toThrow();
    });
  });

  describe('integrity', () => {
    it('Manifest entry contains an integrity property', async () => {
      const { manifest, run } = create(configs.hello(), {
        integrity: true,
        integrityHashes: ['sha256'],
      });

      await run();

      expect(manifest.get('main.js')).toEqual(
        expect.objectContaining({
          src: 'main.js',
          integrity: expect.stringMatching(/^sha256-/),
        }),
      );
    });
  });

  describe('integrityPropertyName', () => {
    it('Assigns SRI hashes to currentAsset.info[ integrityPropertyName ]', async () => {
      const integrityPropertyName = 'sri';

      const { manifest, run } = create(configs.hello(), {
        integrity: true,
        integrityHashes: ['md5'],
        integrityPropertyName,
        customize(_entry, _original, _manifest, asset) {
          expect(integrityPropertyName in asset!.info).toBeTruthy();
        },
      });

      await run();

      expect(manifest.get('main.js')).toEqual(
        expect.objectContaining({
          src: 'main.js',
          integrity: expect.stringMatching(/^md5-/),
        }),
      );
    });

    it('Does not overwrite existing currentAsset.info[ integrityPropertyName ]', async () => {
      const { manifest, run } = create(configs.hello(), {
        integrity: true,
        integrityHashes: ['md5'],
        apply(manifest) {
          manifest.compiler?.hooks.compilation.tap('test', compilation => {
            vi.spyOn(compilation.assetsInfo, 'get').mockImplementation(() => ({
              [manifest.options.integrityPropertyName]: 'test',
            }));
          });
        },
      });

      await run();

      expect(manifest.get('main.js')[manifest.options.integrityPropertyName]).toEqual('test');
    });
  });

  describe('entrypoints', () => {
    it('Entrypoints are included in manifest', async () => {
      const { manifest, run } = create(configs.hello(), {
        entrypoints: true,
      });

      await run();

      const entrypoints = manifest.get('entrypoints');

      expect(entrypoints).toBeInstanceOf(Object);
    });

    it('Entrypoints can use default values instead of values from this.assets', async () => {
      const { manifest, run } = create(configs.hello(), {
        entrypoints: true,
        entrypointsUseAssets: false,
        integrity: true,
      });

      await run();

      expect(manifest.get('entrypoints')).toEqual({
        main: {
          assets: {
            js: ['main.js'],
          },
        },
      });
    });

    it('Entrypoints are prefixed with publicPath when entrypointsUseAssets is false', async () => {
      const { manifest, run } = create(configs.hello(), {
        entrypoints: true,
        entrypointsUseAssets: false,
        publicPath: 'https://example.com/',
      });

      await run();

      expect(manifest.get('entrypoints')).toEqual({
        main: {
          assets: {
            js: ['https://example.com/main.js'],
          },
        },
      });
    });
  });

  describe('entrypointsKey', () => {
    it('customize the key used for entrypoints', async () => {
      const { manifest, run } = create(configs.hello(), {
        entrypoints: true,
        entrypointsKey: 'myEntrypoints',
      });

      await run();

      expect(manifest.get('myEntrypoints')).toBeInstanceOf(Object);
    });

    it('can be false', async () => {
      const { manifest, run } = create(configs.hello(), {
        entrypoints: true,
        entrypointsKey: false,
      });

      await run();

      expect(manifest.get('main')).toBeInstanceOf(Object);
    });
  });

  describe('entrypoints and assets', () => {
    it('Entrypoints in shared assets get merged', async () => {
      const options = {
        assets: Object.create(null),
        entrypoints: true,
      };

      const { manifest, run: run1 } = create(configs.hello(), options);

      const { run: run2 } = create(configs.client(), options);

      await Promise.all([run1(), run2()]);

      const entrypointsKeys = Object.keys(manifest.get('entrypoints'));

      expect(entrypointsKeys).toEqual(expect.arrayContaining(['main', 'client']));
    });
  });

  describe('done', () => {
    it('is called when compilation is done', async () => {
      const mock1 = vi.fn(async () => true);
      const mock2 = vi.fn(async () => true);
      const mock3 = vi.fn();

      const { manifest, run } = create(configs.hello(), {
        async done() {
          await mock1();
        },
      });

      manifest.hooks.done.tapPromise('test', async () => {
        await mock2();
      });

      manifest.hooks.done.tap('test', () => {
        mock3();
      });

      await run();

      expect(mock1).toHaveBeenCalled();
      expect(mock2).toHaveBeenCalled();
      expect(mock3).toHaveBeenCalled();
    });
  });

  describe('contextRelativeKeys', () => {
    it('keys are filepaths relative to the compiler context', async () => {
      const { manifest, run } = create(configs.client(), {
        contextRelativeKeys: true,
      });

      await run();

      expect(manifest.get('client.js')).toEqual('client.js');
      expect(manifest.get('test/fixtures/images/Ginger.asset.jpg')).toEqual('images/Ginger.asset.jpg');
    });
  });

  describe('writeToDisk', () => {
    it.each([
      { fn: webpack, devServerWriteToDisk: true, result: false },
      { fn: makeCompiler, devServerWriteToDisk: true, result: false },
      { fn: makeCompiler, devServerWriteToDisk: false, result: false },
    ])(
      '$fn.name with options.devServer.writeToDisk: $devServerWriteToDisk',
      async ({ fn, devServerWriteToDisk, result }) => {
        const { manifest } = create(
          configs.devServer(),
          {
            writeToDisk: 'auto',
          },
          fn,
        );
        const mockCompilation = {
          getPath: (filename: string) => filename,
          options: {
            devServer: {
              writeToDisk: devServerWriteToDisk,
            },
          },
        } as unknown as Compilation;

        // The plugin shouldn't write to disk if the dev server is configured to do it.
        expect(manifest.shouldWriteToDisk(mockCompilation)).toEqual(result);
      },
    );

    it('Calls options.devServer.writeToDisk() with manifest path', async () => {
      const { compiler, manifest, run } = create(
        configs.devServer(() => false),
        {
          writeToDisk: 'auto',
        },
      );

      type DevMiddleware = NonNullable<WebpackDevServer['options']['devMiddleware']>;
      type WriteToDiskFn = Exclude<NonNullable<DevMiddleware['writeToDisk']>, boolean>;
      type DevMiddlewareWithWriteToDiskFn = Omit<DevMiddleware, 'writeToDisk'> & { writeToDisk: WriteToDiskFn };

      let spy: MockInstance<Parameters<WriteToDiskFn>, ReturnType<WriteToDiskFn>> | undefined;

      compiler.hooks.compilation.tap('test', compilation => {
        if (
          isObject(compilation.options.devServer) &&
          isObject<DevMiddlewareWithWriteToDiskFn>(compilation.options.devServer.devMiddleware) &&
          typeof compilation.options.devServer.devMiddleware.writeToDisk === 'function'
        ) {
          spy = vi
            .spyOn(compilation.options.devServer.devMiddleware, 'writeToDisk')
            .mockImplementation(filePath => manifest.getOutputPath() === filePath);
        }
      });

      await run();

      expect(spy).not.toBeUndefined();
      expect(spy).toHaveBeenCalled();
    });

    describe('extra', () => {
      it('Holds arbitrary data', async () => {
        const { manifest } = create(configs.hello(), {
          extra: {
            test: true,
          },
        });

        expect(manifest.options.extra.test).toEqual(true);
      });
    });

    describe('Default options', () => {
      it('Defaults are used', () => {
        const { manifest } = create(configs.hello());

        expect(manifest.options).toEqual(manifest.defaultOptions);
      });
    });

    describe('Schema validation', () => {
      it('Error is thrown if options schema validation fails', () => {
        expect(() => {
          create(configs.hello(), {
            space: false as unknown as JsonStringifySpace,
          });
        }).toThrow();
      });

      it('Error is thrown when options has unknown property', () => {
        expect(() => {
          create(configs.hello(), {
            someUnknownProperty: 'will fail',
          } as unknown as Options);
        }).toThrow();
      });
    });
  });

  describe('Hooks', function () {
    it('Callbacks passed in options are tapped', function () {
      const { manifest } = create(configs.hello(), {
        apply: () => {},
        customize: () => {},
        transform: assets => assets,
        done: async () => {},
      });

      expect(manifest.hooks.apply.taps.length).greaterThanOrEqual(1);
      expect(manifest.hooks.customize.taps.length).greaterThanOrEqual(1);
      expect(manifest.hooks.transform.taps.length).greaterThanOrEqual(1);
      expect(manifest.hooks.done.taps.length).greaterThanOrEqual(1);
    });

    describe('Apply', function () {
      it('Is called after the manifest is set up', function () {
        const mock = vi.fn();

        create(configs.hello(), {
          apply: mock,
        });

        expect(mock).toHaveBeenCalled();
      });
    });

    describe('Customize', function () {
      it('Can customize an entry', function () {
        const options: Partial<Options> = {
          customize: vi.fn((entry, _original, manifest) => {
            if (manifest.utils.isKeyValuePair(entry)) {
              entry.value = 'customized';
            }
          }),
        };

        const { manifest } = create(configs.hello(), options);

        manifest.set('key', 'not customized');

        expect(manifest.get('key')).toEqual('customized');
      });

      it('Can use manifest.utils', function () {
        expect.assertions(1);

        const { manifest } = create(configs.hello(), {
          customize(_entry, _original, manifest) {
            const utils = Object.entries(manifest.utils);

            expect(utils).toEqual(
              expect.arrayContaining([expect.arrayContaining([expect.any(String), expect.any(Function)])]),
            );
          },
        });

        manifest.set('key', 'value');
      });
    });

    describe('Options', function () {
      it('Options can be altered with a hook', function () {
        const mock = vi.fn(options => {
          options.space = 0;

          return options;
        });

        const { compiler, manifest } = create(configs.hello());

        manifest.hooks.options.tap('test', mock);

        manifest.apply(compiler);

        expect(mock).toHaveBeenCalled();

        expect(manifest.options.space).toEqual(0);
      });
    });

    describe('Transform', function () {
      it('Transforms the data', function () {
        const { manifest } = create(configs.hello(), {
          space: 0,
          transform(assets) {
            return { assets };
          },
        });

        expect(`${manifest}`).toEqual('{"assets":{}}');
      });
    });

    describe('Done', function () {
      it('Is called when the compilation is done', async () => {
        const mock = vi.fn(async () => {});

        const { run } = create(configs.hello(), {
          done: mock,
        });

        await run();

        expect(mock).toHaveBeenCalledOnce();
      });
    });
  });

  describe('Usage with webpack', () => {
    describe.todo('cache', () => {
      it('Can get data from codeGenerationResults', async () => {
        const { manifest, run } = create({
          ...configs.hello(),
          mode: 'production',
          cache: {
            type: 'filesystem',
            cacheDirectory: resolve(currentDirectory, '.webpack-cache'),
          },
        });

        await run();

        expect(manifest.has('main.js')).toBeTruthy();
      });
    });

    describe('Calling set()', () => {
      it('Can set before running', async () => {
        const { manifest, run } = create(configs.hello());

        manifest.set('before', 'value');

        expect(manifest.has('before')).toBeTruthy();

        await run();

        expect(manifest.has('main.js')).toBeTruthy();
      });

      it('May set empty integrity value', async () => {
        const { manifest, run } = create(configs.hello(), { integrity: true });

        manifest.set('before', 'value');

        expect(manifest.get('before')).toEqual(
          expect.objectContaining({
            src: 'value',
            integrity: '',
          }),
        );

        await run();

        expect(manifest.has('main.js')).toBeTruthy();
      });
    });

    describe.sequential('outputFileSystem', () => {
      beforeAll(async () => {
        await mkdir(getWorkspace(), { recursive: true, mode: _777 });
      });

      afterAll(async () => {
        await rimraf(getWorkspace());
      });

      it('Writes to disk', async () => {
        const { compiler, manifest, run } = create(configs.hello(), {
          writeToDisk: true,
        });

        const spy = vi.spyOn(compiler.outputFileSystem!, 'writeFile');

        await run();

        expect(spy).toHaveBeenCalled();

        const content = (await promisify(compiler.outputFileSystem!.readFile)(manifest.getOutputPath()))?.toString();

        expect(manifest.toString()).toEqual(content);
      });

      it('Compiler has error if unable to create directory', async () => {
        const { run } = create(configs.hello(), undefined, webpack);

        await chmod(getWorkspace(), _444);

        await expect(run()).rejects.toThrowError(/permission denied/i);

        await chmod(getWorkspace(), _777);
      });
    });

    it('Finds module assets', async () => {
      const { manifest, run } = create(configs.client(true));

      await run();

      expect(manifest.has('images/Ginger.asset.jpg')).toBeTruthy();
    });

    it('Should support multi compiler mode', async () => {
      const assets = Object.create(null);

      const { run } = createMulti(configs.multi(), { assets });

      await expect(run()).resolves.toEqual(
        expect.objectContaining({
          stats: expect.arrayContaining([expect.any(Object), expect.any(Object)]),
        }),
      );

      expect(assets).toMatchObject({
        'server.js': 'server.js',
        'images/Ginger.loader.jpg': 'images/Ginger.loader.jpg',
        'client.js': 'client.js',
        'images/Ginger.asset.jpg': 'images/Ginger.asset.jpg',
      });
    });

    describe('Handles complex configurations', async () => {
      const { manifest, run } = create(configs.complex(), {
        output: './reports/assets-manifest.json',
        integrity: true,
        integrityHashes: ['md5'],
        entrypoints: true,
        entrypointsUseAssets: true,
        publicPath: true,
        contextRelativeKeys: false,
        customize(entry, original, manifest, asset) {
          if (entry) {
            if (typeof entry.key === 'string' && entry.key?.toLowerCase().startsWith('main')) {
              return false;
            }

            return {
              value: {
                publicPath: entry.value,
                value: original.value,
                integrity: asset?.info[manifest.options.integrityPropertyName],
              },
            };
          }

          return entry;
        },
        transform(assets) {
          const { entrypoints, ...others } = assets;

          return {
            entrypoints,
            assets: others,
          };
        },
      });

      await run();

      it('main assets were excluded in customize()', () => {
        const { assets } = manifest.toJSON();

        expect(assets).not.toHaveProperty('main.js');
        expect(assets).not.toHaveProperty('main.css');
      });

      it('Entrypoints use values from assets (could be a customized value)', () => {
        const { assets, entrypoints } = manifest.toJSON();

        expect(entrypoints.complex.assets.js[0]).toEqual(assets['complex.js']);
      });

      it('Entrypoints use default values when corresponding asset is not found (excluded during customize)', () => {
        const { entrypoints } = manifest.toJSON();

        expect(entrypoints.main.assets).toEqual({
          css: ['https://assets.example.com/main-HASH.css'],
          js: ['https://assets.example.com/main-HASH.js'],
        });
      });
    });

    describe('Handles multiple plugin instances being used', () => {
      it('manifests does not contain other manifests', async () => {
        const config = configs.complex();
        const manifest = new WebpackAssetsManifest();
        const integrityManifest = new WebpackAssetsManifest({
          output: 'reports/integrity-manifest.json',
          integrity: true,
        });

        config.plugins.push(manifest, integrityManifest);

        const compiler = makeCompiler(config);

        const run = makeRun(compiler);

        await expect(run()).resolves.toBeInstanceOf(Object);

        expect(manifest.has(integrityManifest.options.output)).toBeFalsy();
        expect(integrityManifest.has(manifest.options.output)).toBeFalsy();
      });
    });

    describe('Uses asset.info.sourceFilename when assetNames does not have a matching asset', () => {
      it('contextRelativeKeys is on', async () => {
        const { manifest, run } = create(configs.client(), {
          contextRelativeKeys: true,
        });

        // Pretend like assetNames is empty.
        const mock = vi.spyOn(manifest.assetNames, 'entries').mockImplementation(() => new Map().entries());

        await run();

        expect(mock).toHaveBeenCalled();

        expect(manifest.has('test/fixtures/images/Ginger.asset.jpg')).toBeTruthy();
      });

      it('contextRelativeKeys is off', async () => {
        const { manifest, run } = create(configs.client(), {
          contextRelativeKeys: false,
        });

        // Pretend like assetNames is empty.
        const mock = vi.spyOn(manifest.assetNames, 'entries').mockImplementation(() => new Map().entries());

        await run();

        expect(mock).toHaveBeenCalled();
        expect(manifest.has('Ginger.asset.jpg')).toBeTruthy();
      });
    });

    it('Finds css files', async () => {
      const { manifest, run } = create(configs.styles());

      await run();

      expect(manifest.toString()).toEqual(expect.stringContaining('styles.css'));
    });

    it('Should ignore HMR files', function () {
      const config = configs.hello();

      const { manifest } = create(config);

      manifest.processAssetsByChunkName(
        {
          main: ['main.123456.js', '0.123456.hot-update.js'],
        },
        new Set(['0.123456.hot-update.js']),
      );

      expect(manifest.assetNames.get('main.js')).toEqual('main.123456.js');
      expect([...manifest.assetNames.values()].includes('0.123456.hot-update.js')).toBeFalsy();
    });
  });

  describe('Usage with webpack-dev-server', () => {
    it('inDevServer() should return true', async () => {
      const { compiler, manifest } = create(configs.devServer(), undefined, webpack);

      const server = new WebpackDevServer(undefined, compiler);

      await server.start();

      expect(manifest.inDevServer()).toBeTruthy();

      await server.stop();
    });

    it('Should serve the assets manifest JSON file', async () => {
      const { compiler } = create(configs.devServer(), undefined, webpack);

      const server = new WebpackDevServer(
        {
          host: 'localhost',
        },
        compiler,
      );

      await server.start();

      await expect(
        fetch(`http://${server.options.host}:${server.options.port}/assets-manifest.json`),
      ).resolves.toHaveProperty('status', 200);

      await server.stop();
    });

    describe('writeToDisk', () => {
      beforeAll(async () => {
        await mkdir(getWorkspace(), { recursive: true, mode: _777 });
      });

      afterAll(async () => {
        await rimraf(getWorkspace());
      });

      it('Should write to disk using absolute output path', async () => {
        const config = configs.devServer();
        const { compiler, manifest } = create(config, {
          output: join(config.output.path, 'assets', 'assets-manifest.json'),
          writeToDisk: true,
        });

        const server = new WebpackDevServer(
          {
            host: 'localhost',
          },
          compiler,
        );

        await server.start();

        await expect(
          fetch(`http://${server.options.host}:${server.options.port}/assets-manifest.json`),
        ).resolves.toHaveProperty('status', 200);

        const manifestStats = await stat(manifest.getOutputPath());

        expect(manifestStats.isFile()).toBeTruthy();

        await server.stop();
      });

      it('Should write to compiler.outputPath if no output paths are specified', async () => {
        const config = {
          ...configs.devServer(),
          output: undefined,
        };

        const { compiler, manifest } = create(config, {
          writeToDisk: true,
        });

        const server = new WebpackDevServer(
          {
            host: 'localhost',
          },
          compiler,
        );

        await server.start();

        await expect(
          fetch(`http://${server.options.host}:${server.options.port}/assets-manifest.json`),
        ).resolves.toHaveProperty('status', 200);

        const manifestStats = await stat(manifest.getOutputPath());

        expect(manifest.getOutputPath().startsWith(compiler.outputPath)).toBeTruthy();

        expect(manifestStats.isFile()).toBeTruthy();

        await server.stop();
      });

      it('writeToDisk: auto', async () => {
        const { compiler, manifest } = create(
          configs.devServer(),
          {
            writeToDisk: 'auto',
          },
          webpack,
        );

        const server = new WebpackDevServer(undefined, compiler);

        await server.start();

        const mockCompilation = {
          options: {
            devServer: {
              writeToDisk: true,
            },
          },
        } as unknown as Compilation;

        expect(manifest.shouldWriteToDisk(mockCompilation)).toBeFalsy();

        await server.stop();
      });
    });
  });

  describe('Usage with webpack plugins', () => {
    describe('webpack.ModuleFederationPlugin', () => {
      it('Finds `exposes` entries', async () => {
        const { manifest, run } = create({
          ...configs.hello(),
          devtool: 'cheap-source-map',
          plugins: [
            new container.ModuleFederationPlugin({
              name: 'remote',
              filename: 'remote-entry.js',
              exposes: {
                './remote': resolve(currentDirectory, 'fixtures/remote.js'),
              },
            }),
          ],
        });

        await run();

        expect(manifest.has('remote.js')).toBeTruthy();
      });
    });

    describe('copy-webpack-plugin', () => {
      it('Finds copied files', async () => {
        const { manifest, run } = create(configs.copy());

        await run();

        expect(manifest.get('readme.md')).toEqual('readme-copied.md');
      });
    });

    describe('compression-webpack-plugin', () => {
      it('Adds gz filenames to the manifest', async () => {
        const { manifest, run } = create(configs.compression());

        await run();

        expect(manifest.get('main.js.gz')).toEqual('main.js.gz');
      });
    });

    describe('webpack-subresource-integrity', () => {
      it('Uses integrity value from webpack-subresource-integrity plugin', async () => {
        const { manifest, run } = create(configs.sri(), {
          integrity: true,
          integrityHashes: ['md5', 'sha256'],
          integrityPropertyName: 'sri',
        });

        await run();

        expect(manifest.get('main.js')).toEqual(
          expect.objectContaining({
            integrity: expect.stringMatching(/^md5-.+\ssha256-/),
          }),
        );
      });

      it('Uses integrity value from this plugin', async () => {
        const { manifest, run } = create(configs.sri(), {
          integrity: true,
          integrityPropertyName: 'md5',
          integrityHashes: ['md5'],
        });

        await run();

        expect(manifest.get('main.js').integrity.startsWith('md5-')).toBeTruthy();
      });
    });
  });
});
