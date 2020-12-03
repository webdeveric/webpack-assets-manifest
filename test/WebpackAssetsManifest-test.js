'use strict';

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const mkdirp = require('mkdirp');
const chai = require('chai');
const spies = require('chai-spies');
const rimraf = require('rimraf');
const webpack = require('webpack');
const { mkdirp: webpack_mkdirp } = require('webpack/lib/util/fs');
const superagent = require('superagent');
const configs = require('./fixtures/configs');
const makeCompiler = require('./fixtures/makeCompiler');

const WebpackAssetsManifest = require('../src/WebpackAssetsManifest');
const { assert, expect } = chai;

chai.use(spies);

const _444 = 0o444;
const _777 = 0o777;

console.log( chalk`Webpack version: {blueBright.bold %s}`, require('webpack/package.json').version );
console.log( chalk`Webpack dev server version: {blueBright.bold %s}`, require('webpack-dev-server/package.json').version );

function create( config, pluginOptions, comp = makeCompiler )
{
  let manifest;

  if ( Array.isArray( pluginOptions ) ) {
    const [ options, callback ] = pluginOptions;

    manifest = new WebpackAssetsManifest( options );

    callback( manifest );
  } else {
    manifest = new WebpackAssetsManifest( pluginOptions );
  }

  config.plugins.push( manifest );

  const compiler = comp( config );

  const run = () => new Promise( (resolve, reject) => {
    compiler.run( err => err ? reject( err ) : resolve() );
  });

  return { compiler, manifest, run };
}

describe('WebpackAssetsManifest', function() {
  beforeEach(() => {
    chai.spy.on(console, 'info', () => {});
    chai.spy.on(console, 'warn', () => {});
  });

  afterEach(() => {
    chai.spy.restore();
  });

  before('set up', async () => {
    await mkdirp(configs.getWorkspace(), _777);
  });

  after('clean up', done => {
    rimraf(configs.getWorkspace(), function(err) {
      if (err) {
        throw err;
      }

      done();
    });
  });

  describe('Methods', function() {
    describe('getExtension()', function() {
      const manifest = new WebpackAssetsManifest();

      it('should return the file extension', function() {
        assert.equal('.css', manifest.getExtension('main.css'));
      });

      it('should return two extensions for known formats', function() {
        assert.equal('.js.map', manifest.getExtension('main.js.map'));
        assert.equal('.css.map', manifest.getExtension('main.css.map'));
        assert.equal('.tar.gz', manifest.getExtension('archive.tar.gz'));
        assert.equal('.ext', manifest.getExtension('some.unknown.ext'));
      });

      it('should return empty string when filename is undefined or empty', function() {
        assert.equal('', manifest.getExtension());
        assert.equal('', manifest.getExtension(''));
      });

      it('should return empty string when filename does not have an extension', function() {
        assert.equal('', manifest.getExtension('no-extension'));
      });

      it('should ignore query string and fragment', function() {
        assert.equal('.js', manifest.getExtension('main.js?a=1'));
        assert.equal('.js', manifest.getExtension('main.js#b'));
        assert.equal('.js', manifest.getExtension('main.js?a=1#b'));
      });
    });

    describe('toJSON()', function() {
      const manifest = new WebpackAssetsManifest();

      it('should return an object', function() {
        assert.deepEqual({}, manifest.toJSON());
        assert.equal('{}', JSON.stringify(manifest));
      });
    });

    describe('toString()', function() {
      const manifest = new WebpackAssetsManifest();

      it('should return a JSON string', function() {
        assert.equal('{}', manifest.toString());
        assert.equal('{}', manifest + '');
      });
    });

    describe('getOutputPath()', function() {
      it('should work with an absolute output path', function() {
        const { manifest } = create(
          configs.hello(),
          {
            output: '/manifest.json',
          },
        );

        assert.equal('/manifest.json', manifest.getOutputPath());
      });

      it('should work with a relative output path', function() {
        const { compiler, manifest } = create(
          configs.hello(),
          {
            output: '../manifest.json',
          },
        );

        assert.equal(
          path.resolve(compiler.options.output.path, '../manifest.json'),
          manifest.getOutputPath(),
        );
      });

      it('should output manifest in compiler output.path by default', function() {
        const { compiler, manifest } = create( configs.hello() );

        assert.equal(
          compiler.options.output.path,
          path.dirname(manifest.getOutputPath()),
        );
      });

      it('should return an empty string if manifest has not been applied yet', function() {
        const manifest = new WebpackAssetsManifest();

        assert.equal('', manifest.getOutputPath());
      });
    });

    describe('fixKey()', function() {
      it('should replace \\ with /', function() {
        const manifest = new WebpackAssetsManifest();

        assert.equal('images/Ginger.jpg', manifest.fixKey('images\\Ginger.jpg'));
      });

      it('should return the key if not a string', function() {
        const manifest = new WebpackAssetsManifest();

        assert.equal(1, manifest.fixKey(1));
      });
    });

    describe('set()', function() {
      it('should add to manifest.assets', function() {
        const manifest = new WebpackAssetsManifest();

        assert.deepEqual({}, manifest.assets);

        manifest.set('main.js', 'main.123456.js');
        manifest.set('styles/main.css', 'styles/main.123456.css');

        assert.deepEqual(
          {
            'main.js': 'main.123456.js',
            'styles/main.css': 'styles/main.123456.css',
          },
          manifest.assets,
        );
      });

      it('should transform backslashes to slashes', function() {
        const manifest = new WebpackAssetsManifest();

        assert.deepEqual({}, manifest.assets);

        manifest.set('images\\a.jpg', 'images/a.123456.jpg');

        assert.deepEqual(
          {
            'images/a.jpg': 'images/a.123456.jpg',
          },
          manifest.assets,
        );
      });
    });

    describe('setRaw()', function() {
      it('Uses keys without fixing them', function() {
        const manifest = new WebpackAssetsManifest();

        manifest.setRaw('\\\\', 'image.jpg');

        assert.isTrue( manifest.has('\\\\') );
        assert.equal( manifest.get('\\\\'), 'image.jpg' );
      });
    });

    describe('has()', function() {
      it('should return a boolean', function() {
        const manifest = new WebpackAssetsManifest({
          assets: Object.assign({}, require('./fixtures/json/images.json')),
        });

        assert.isTrue(manifest.has('Ginger.jpg'));
        assert.isFalse(manifest.has('dog.gif'));
      });
    });

    describe('get()', function() {
      const manifest = new WebpackAssetsManifest({
        assets: Object.assign({}, require('./fixtures/json/images.json')),
      });

      it('gets a value from the manifest', function() {
        assert.equal('images/Ginger.jpg', manifest.get('Ginger.jpg'));
      });

      it('returns a default value', function() {
        const defaultValue = 'some/default.gif';

        assert.equal(defaultValue, manifest.get('dog.gif', defaultValue));
      });

      it('returns undefined when no default value is provided', function() {
        assert.equal(undefined, manifest.get('dog.gif'));
      });
    });

    describe('delete()', function() {
      it('removes an asset from the manifest', function() {
        const manifest = new WebpackAssetsManifest();

        [ 'some/image.jpg', 'some\\image.jpg' ].forEach( key => {
          [ 'set', 'setRaw' ].forEach( method => {
            manifest[ method ](key, 'image.jpg');

            assert.isTrue( manifest.has(key) );

            manifest.delete(key);

            assert.isFalse( manifest.has(key) );
          });
        });

        assert.isFalse( manifest.delete('404.js') );
      });
    });

    describe('inDevServer()', function() {
      let originalEnv;

      before(() => {
        originalEnv = { ...process.env };
      });

      after(() => {
        process.env = originalEnv;
      });

      it('Identifies webpack-dev-server from process.env', function() {
        const manifest = new WebpackAssetsManifest();

        delete process.env.WEBPACK_DEV_SERVER;

        assert.isFalse( manifest.inDevServer() );

        process.env.WEBPACK_DEV_SERVER = true;

        assert.isTrue( manifest.inDevServer() );
      });
    });

    describe('getProxy()', function() {
      it('Returns a Proxy', function() {
        const manifest = new WebpackAssetsManifest();

        [ undefined, false, true ].forEach( raw => {
          const proxy = manifest.getProxy( raw );

          assert.instanceOf(proxy, WebpackAssetsManifest);

          proxy[ 'test' ] = 'test';

          assert.isTrue( 'test' in proxy );

          assert.equal( 'test', proxy[ 'test' ] );

          delete proxy[ 'test' ];

          assert.isUndefined( proxy[ 'test' ] );
          assert.isFalse( 'test' in proxy );
        });
      });
    });

    describe('clear()', function() {
      it('clears data', async () => {
        const { manifest, run } = create( configs.hello() );

        expect( manifest.assets ).to.be.empty;

        await run();

        expect( manifest.assets ).to.not.be.empty;

        manifest.clear();

        expect( manifest.assets ).to.be.empty;
      });
    });
  });

  describe('Options', function() {
    describe('enabled', function() {
      it('does nothing if not enabled', async () => {
        const { manifest, run } = create(
          configs.hello(),
          {
            enabled: false,
          },
        );

        await run();

        expect( manifest.assets ).to.be.empty;
      });
    });

    describe('sortManifest', function() {
      const assets = {
        'd.js': 'd.js',
        'c.js': 'c.js',
        'b.js': 'b.js',
        'a.js': 'a.js',
      };

      it('should turn on sorting', function() {
        const manifest = new WebpackAssetsManifest({
          assets,
          sortManifest: true,
          space: 0,
        });

        assert.equal(
          '{"a.js":"a.js","b.js":"b.js","c.js":"c.js","d.js":"d.js"}',
          manifest.toString(),
        );
      });

      it('should turn off sorting', function() {
        const manifest = new WebpackAssetsManifest({
          assets,
          sortManifest: false,
          space: 0,
        });

        manifest.processAssetsByChunkName(assets);

        assert.equal(
          '{"d.js":"d.js","c.js":"c.js","b.js":"b.js","a.js":"a.js"}',
          manifest.toString(),
        );
      });

      it('should use custom comparison function', function() {
        const manifest = new WebpackAssetsManifest({
          assets,
          sortManifest: function(a, b) {
            return a.localeCompare(b);
          },
          space: 0,
        });

        manifest.processAssetsByChunkName(assets);

        assert.equal(
          '{"a.js":"a.js","b.js":"b.js","c.js":"c.js","d.js":"d.js"}',
          manifest.toString(),
        );
      });
    });

    describe('fileExtRegex', function() {
      it('should use custom RegExp', function() {
        const manifest = new WebpackAssetsManifest({
          fileExtRegex: /\.[a-z0-9]+$/i,
        });

        assert.equal(manifest.getExtension('test.js'), '.js');
        assert.equal(manifest.getExtension('test.js.map'), '.map');
      });

      it('should fallback to path.extname', function() {
        const manifest = new WebpackAssetsManifest({
          fileExtRegex: false,
        });

        assert.equal(manifest.getExtension('test.js'), '.js');
      });
    });

    describe('replacer', function() {
      const assets = {
        'logo.svg': 'images/logo.svg',
      };

      it('should remove all entries', function() {
        const manifest = new WebpackAssetsManifest({
          assets,
          replacer: () => undefined,
        });

        assert.equal('{}', manifest.toString());
      });

      it('should update values', function() {
        const manifest = new WebpackAssetsManifest({
          assets,
          space: 0,
          replacer: function(key, value) {
            if ( typeof value === 'string' ) {
              return value.toUpperCase();
            }

            return value;
          },
        });

        assert.equal('{"logo.svg":"IMAGES/LOGO.SVG"}', manifest.toString());
      });
    });

    describe('assets', function() {
      const assets = {
        'logo.svg': 'images/logo.svg',
      };

      it('should set the initial assets data', function() {
        const manifest = new WebpackAssetsManifest({
          assets: Object.assign({}, require('./fixtures/json/images.json')),
          space: 0,
        });

        Object.keys( assets ).forEach( key => {
          manifest.set(key, assets[ key ]);
        });

        assert.equal(
          '{"Ginger.jpg":"images/Ginger.jpg","logo.svg":"images/logo.svg"}',
          manifest.toString(),
        );
      });

      it('should be sharable', function() {
        const sharedAssets = Object.create(null);

        const { manifest: manifest1 } = create(
          configs.hello(),
          {
            assets: sharedAssets,
          },
        );

        const { manifest: manifest2 } = create(
          configs.client(),
          {
            assets: sharedAssets,
          },
        );

        manifest1.set('main.js', 'main.js');
        manifest2.set('subpage.js', 'subpage.js');

        assert.equal(manifest1.toString(), manifest2.toString());
      });
    });

    describe('merge', function() {
      async function setupManifest(manifest)
      {
        await mkdirp( path.dirname( manifest.getOutputPath() ) );

        await fs.promises.copyFile(
          path.resolve(__dirname, 'fixtures/json/sample-manifest.json'),
          manifest.getOutputPath(),
        );

        return manifest;
      }

      it('should merge data if output file exists', async () => {
        const { manifest, run } = create(
          configs.hello(),
          {
            entrypoints: true,
            merge: true,
            space: 0,
          },
        );

        await setupManifest(manifest);
        await run();

        assert.equal(
          '{"Ginger.jpg":"images/Ginger.jpg","entrypoints":{"main":{"assets":{"css":["main.css"],"js":["main.js"]}},"demo":{"assets":{"js":["demo.js"]}}},"main.js":"main.js"}',
          manifest.toString(),
        );
      });

      it('can customize during merge', async () => {
        const mergingResults = [];
        const { manifest, run } = create(
          configs.hello(),
          {
            merge: 'customize',
            space: 0,
            customize(entry, original, manifest) {
              assert.isBoolean(manifest.isMerging);
              mergingResults.push(manifest.isMerging);
            },
          },
        );

        await setupManifest(manifest);
        await run();

        assert.isTrue( mergingResults.some( r => r === true ) );
        assert.isTrue( mergingResults.some( r => r === false ) );
      });

      it('merge skips customize()', async () => {
        const mock = chai.spy();

        const { manifest, run } = create(
          configs.hello(),
          {
            merge: true,
            customize(entry, original, manifest) {
              if ( manifest.isMerging ) {
                mock();
              }
            },
          },
        );

        await setupManifest(manifest);
        await run();

        expect( mock ).to.not.have.been.called();
      });
    });

    describe('publicPath', function() {
      const img = 'images/photo.jpg';
      const cdn = {
        default: 'https://cdn.example.com/',
        images: 'https://img-cdn.example.com/',
      };

      it('can be a string', function() {
        const manifest = new WebpackAssetsManifest({
          publicPath: 'assets/',
        });

        manifest.set('hello', 'world');
        assert.equal( manifest.get('hello'), 'assets/world' );
      });

      it('can be true', async () => {
        const config = configs.hello();

        config.output.publicPath = cdn.default;

        const { manifest, run } = create(
          config,
          {
            publicPath: true,
          },
        );

        await run();

        assert.equal( cdn.default + 'main.js', manifest.get('main.js') );
      });

      it('has no effect if false', async () => {
        const config = configs.hello();

        config.output.publicPath = cdn.default;

        const { manifest, run } = create(
          config,
          {
            publicPath: false,
          },
        );

        await run();

        assert.equal('main.js', manifest.get('main.js') );
      });

      it('only prefixes strings', function() {
        const manifest = new WebpackAssetsManifest({
          publicPath: cdn.default,
        });

        manifest.set('obj', {} );

        assert.deepEqual({}, manifest.get('obj'));
      });

      it('can be a custom function', function() {
        const manifest = new WebpackAssetsManifest({
          publicPath: function( val, manifest ) {
            if ( manifest.getExtension( val ).substr(1).toLowerCase() ) {
              return cdn.images + val;
            }

            return cdn.default + val;
          },
        });

        assert.isFunction( manifest.options.publicPath );

        manifest.set( img, img );

        assert.equal( cdn.images + img, manifest.get( img ) );
      });
    });

    describe('customize', function() {
      it('customizes the key and value', function() {
        const { manifest } = create(
          configs.hello(),
          {
            customize(entry) {
              return {
                key: entry.key.toUpperCase(),
                value: entry.value.toUpperCase(),
              };
            },
          },
        );

        manifest.set('hello', 'world');

        assert.isTrue( manifest.has('HELLO') );
        assert.isFalse( manifest.has('hello') );
      });

      it('customizes the key', function() {
        const { manifest } = create(
          configs.hello(),
          {
            customize(entry) {
              return {
                key: entry.key.toUpperCase(),
              };
            },
          },
        );

        manifest.set('hello', 'world');

        assert.isTrue( manifest.has('HELLO') );
        assert.isFalse( manifest.has('hello') );
        assert.equal( manifest.get('HELLO'), 'world' );
      });

      it('customizes the value', function() {
        const { manifest } = create(
          configs.hello(),
          {
            customize(entry) {
              return {
                value: entry.value.toUpperCase(),
              };
            },
          },
        );

        manifest.set('hello', 'world');

        assert.isFalse( manifest.has('HELLO') );
        assert.isTrue( manifest.has('hello') );
        assert.equal( manifest.get('hello'), 'WORLD' );
      });

      it('has no effect unless an object or false is returned', function() {
        const { manifest } = create(
          configs.hello(),
          {
            customize() {
              return 3.14;
            },
          },
        );

        manifest.set('hello', 'world');

        assert.isTrue( manifest.has('hello') );
        assert.equal( manifest.get('hello'), 'world' );
      });

      it('skips adding asset if false is returned', function() {
        const { manifest } = create(
          configs.hello(),
          {
            customize() {
              return false;
            },
          },
        );

        manifest.set('hello', 'world');

        assert.isFalse( manifest.has('hello') );
        assert.deepEqual( {}, manifest.assets );
      });
    });

    describe('integrityHashes', function() {
      it('invalid crypto hashes are filtered out', function() {
        const { manifest } = create(
          configs.hello(),
          {
            integrityHashes: [ 'sha256', 'invalid-algorithm' ],
          },
        );

        assert.notInclude(manifest.options.integrityHashes, 'invalid-algorithm');
      });
    });

    describe('integrity', function() {
      it('manifest entry contains an integrity property', async () => {
        const { manifest, run } = create(
          configs.hello(),
          {
            integrity: true,
          },
        );

        await run();

        const asset = manifest.get('main.js');

        assert.typeOf(asset, 'object');
        assert.property(asset, 'integrity');
        assert.isNotEmpty( asset.integrity );
      });
    });

    describe('integrityPropertyName', function() {
      it('Assigns SRI hashes to currentAsset.info[ integrityPropertyName ]', async () => {
        const integrityPropertyName = 'sri';
        const { run } = create(
          configs.hello(),
          {
            integrity: true,
            integrityHashes: [ 'md5' ],
            integrityPropertyName,
            customize(entry, original, manifest, asset) {
              assert.containsAllKeys(
                asset.info,
                [ integrityPropertyName ],
                `asset.info is missing ${integrityPropertyName} property`,
              );
            },
          },
        );

        await run();
      });

      it('Does not overwrite existing currentAsset.info[ integrityPropertyName ]', async () => {
        const { manifest, run } = create(
          configs.hello(),
          {
            integrity: true,
            integrityHashes: [ 'md5' ],
            apply(manifest) {
              manifest.compiler.hooks.compilation.tap(
                'test',
                compilation => {
                  chai.spy.on(compilation.assetsInfo, 'get', () => ({
                    [ manifest.options.integrityPropertyName ]: 'test',
                  }));
                },
              );
            },
          },
        );

        await run();

        expect( manifest.get('main.js')[ manifest.options.integrityPropertyName ] ).to.equal('test');
      });
    });

    describe('entrypoints', function() {
      it('entrypoints are included in manifest', async () => {
        const { manifest, run } = create(
          configs.hello(),
          {
            entrypoints: true,
          },
        );

        await run();

        const entrypoints = manifest.get('entrypoints');

        assert.typeOf(entrypoints, 'object');
      });

      it('entrypoints can use default values instead of values from this.assets', async () => {
        const { manifest, run } = create(
          configs.hello(),
          {
            entrypoints: true,
            entrypointsUseAssets: false,
            integrity: true,
          },
        );

        await run();

        expect( manifest.get('entrypoints') ).to.deep.equal({
          main: {
            assets: {
              js: [ 'main.js' ],
            },
          },
        });
      });
    });

    describe('entrypointsKey', function() {
      it('customize the key used for entrypoints', async () => {
        const { manifest, run } = create(
          configs.hello(),
          {
            entrypoints: true,
            entrypointsKey: 'myEntrypoints',
          },
        );

        await run();

        const entrypoints = manifest.get('myEntrypoints');

        assert.typeOf(entrypoints, 'object');
      });

      it('can be false', async () => {
        const { manifest, run } = create(
          configs.hello(),
          {
            entrypoints: true,
            entrypointsKey: false,
          },
        );

        await run();

        const entrypoint = manifest.get('main');

        assert.typeOf(entrypoint, 'object');
      });
    });

    describe('done', function() {
      it('is called when compilation is done', async () => {
        const mock1 = chai.spy( async () => true );
        const mock2 = chai.spy( async () => true );
        const mock3 = chai.spy();
        const { manifest, run } = create(
          configs.hello(),
          {
            async done() {
              await mock1();
            },
          },
        );

        manifest.hooks.done.tapPromise('test', async () => { await mock2(); });
        manifest.hooks.done.tap('test', () => { mock3(); });

        await run();

        expect( mock1 ).to.have.been.called;
        expect( mock2 ).to.have.been.called;
        expect( mock3 ).to.have.been.called;
      });
    });

    describe('contextRelativeKeys', function() {
      it('keys are filepaths relative to the compiler context', async () => {
        const { manifest, run } = create(
          configs.client(),
          {
            contextRelativeKeys: true,
          },
        );

        await run();

        expect( manifest.get('client.js') ).to.equal('client.js');
        expect( manifest.get('test/fixtures/images/Ginger.asset.jpg') ).to.equal('images/Ginger.asset.jpg');
      });
    });

    describe('Default options', function() {
      it('Defaults are used', function() {
        const { manifest } = create( configs.hello() );

        expect( manifest.options ).to.deep.equal( manifest.defaultOptions );
      });
    });

    describe('Schema validation', function() {
      it('Error is thrown if options schema validation fails', function() {
        expect(() => {
          create(
            configs.hello(),
            {
              space: false,
            },
          );
        }).to.throw();
      });

      it('Error is thrown when options has unknown property', function() {
        expect(() => {
          create(
            configs.hello(),
            {
              someUnknownProperty: 'will fail',
            },
          );
        }).to.throw();
      });
    });
  });

  describe('Hooks', function() {
    it('Callbacks passed in options are tapped', function() {
      const { manifest } = create(
        configs.hello(),
        {
          apply: () => {},
          customize: () => {},
          transform: () => {},
          done: () => {},
        },
      );

      expect( manifest.hooks.apply.taps.length ).to.be.at.least(1);
      expect( manifest.hooks.customize.taps.length ).to.be.at.least(1);
      expect( manifest.hooks.transform.taps.length ).to.be.at.least(1);
      expect( manifest.hooks.done.taps.length ).to.be.at.least(1);
    });

    describe('Apply', function() {
      it('Is called after the manifest is set up', function() {
        const mock = chai.spy();

        create(
          configs.hello(),
          {
            apply() {
              mock();
            },
          },
        );

        expect( mock ).to.have.been.called();
      });
    });

    describe('Customize', function() {
      it('Can customize an entry', function() {
        const { manifest } = create(
          configs.hello(),
          {
            customize(entry) {
              entry.value = 'customized';
            },
          },
        );

        manifest.set('key', 'not customized');

        expect( manifest.get('key') ).to.equal('customized');
      });
    });

    describe('Options', function() {
      it('Options can be altered with a hook', function() {
        const mock = chai.spy( options => {
          options.space = 0;

          return options;
        });

        const { manifest } = create(
          configs.hello(),
          [
            undefined,
            manifest => manifest.hooks.options.tap('test', mock ),
          ],
        );

        expect( mock ).to.have.been.called();

        expect( manifest.options.space ).to.equal(0);
      });
    });

    describe('Transform', function() {
      it('Transforms the data', function() {
        const { manifest } = create(
          configs.hello(),
          {
            space: 0,
            transform(assets) {
              return { assets };
            },
          },
        );

        expect(`${manifest}`).to.equal('{"assets":{}}');
      });
    });

    describe('Done', function() {
      it('Is called when the compilation is done', async () => {
        const mock = chai.spy();
        const { run } = create(
          configs.hello(),
          [
            {
              done() {
                mock();
              },
            },
            () => {
              expect( mock ).to.not.have.been.called();
            },
          ],
        );

        await run();

        expect( mock ).to.have.been.called();
      });
    });
  });

  describe('Usage with webpack', function() {
    it('writes to disk', async () => {
      const { manifest, run } = create(
        configs.hello(),
        {
          writeToDisk: true,
        },
      );

      await run();

      const content = await fs.promises.readFile( manifest.getOutputPath() );

      assert.equal( manifest.toString(), content.toString() );
    });

    it('compiler has error if unable to create directory', async () => {
      fs.chmodSync(configs.getWorkspace(), _444);

      const { run } = create(
        configs.hello(),
        undefined,
        webpack,
      );

      const error = await run().catch( error => error );

      assert.isNotNull(error, 'Permissions error not found');
      assert.equal('EACCES', error.code);

      fs.chmodSync(configs.getWorkspace(), _777);
    });

    it('finds module assets', async () => {
      const { manifest, run } = create( configs.client( true ) );

      await run();

      assert.isTrue( manifest.has('images/Ginger.asset.jpg') );
    });

    it('should support multi compiler mode', done => {
      const assets = Object.create(null);
      const multiConfig = configs.multi().map( config => {
        config.plugins = [
          new WebpackAssetsManifest({
            assets,
          }),
        ];

        return config;
      });

      webpack(multiConfig, function( err ) {
        assert.isNull(err, 'Error found in compiler.run');

        const manifestPath = multiConfig[ 0 ].plugins[ 0 ].getOutputPath();

        assert.strictEqual(
          multiConfig[ 0 ].plugins[ 0 ].assets,
          multiConfig[ 1 ].plugins[ 0 ].assets,
        );

        fs.readFile(
          manifestPath,
          function(err, content) {
            assert.isNull(err, 'Error reading assets manifest');
            assert.include(content.toString(), 'client.js');
            assert.include(content.toString(), 'server.js');
            assert.include(content.toString(), 'images/Ginger.asset.jpg');

            done();
          },
        );
      });
    });

    describe('Handles complex configurations', () => {
      let manifest;

      before(async () => {
        const created = create(
          configs.complex(),
          {
            output: './reports/assets-manifest.json',
            integrity: true,
            integrityHashes: [ 'md5' ],
            entrypoints: true,
            entrypointsUseAssets: true,
            publicPath: true,
            contextRelativeKeys: false,
            customize(entry, original, manifest, asset) {
              if ( entry.key.toLowerCase().startsWith('main') ) {
                return false;
              }

              return {
                value: {
                  publicPath: entry.value,
                  value: original.value,
                  integrity: asset.info[ manifest.options.integrityPropertyName ],
                },
              };
            },
            transform(assets) {
              const { entrypoints, ...others } = assets;

              return {
                entrypoints,
                assets: others,
              };
            },
          },
          webpack,
        );

        manifest = created.manifest;

        await created.run();
      });

      it('main assets were excluded in customize()', () => {
        const { assets } = manifest.toJSON();

        expect( assets ).to.not.have.keys([ 'main.js', 'main.css' ]);
      });

      it('asset names point to the same file due to module.rules config', () => {
        const { assets } = manifest.toJSON();

        expect( assets[ 'images/Ginger.asset.jpg' ] ).to.deep.equal( assets[ 'images/Ginger.loader.jpg' ] );
      });

      it('entrypoints use values from assets (could be a customized value)', () => {
        const { assets, entrypoints } = manifest.toJSON();

        expect( entrypoints.complex.assets.js[ 0 ] ).to.deep.equal( assets[ 'complex.js' ] );
      });

      it('entrypoints use default values when corresponding asset is not found (excluded during customize)', () => {
        const { entrypoints } = manifest.toJSON();

        expect( entrypoints.main.assets ).to.deep.equal({
          css: [ 'main-HASH.css' ],
          js: [ 'main-HASH.js' ],
        });
      });
    });

    describe('Handles multiple plugin instances being used', () => {
      it('manifests does not contain other manifests', done => {
        const config = configs.complex();

        const manifest = new WebpackAssetsManifest();
        const integrityManifest = new WebpackAssetsManifest({
          output: 'reports/integrity-manifest.json',
          integrity: true,
        });

        config.plugins.push( manifest, integrityManifest );

        const compiler = makeCompiler( config );

        compiler.run( err => {
          expect( err ).to.be.null;
          expect( manifest.has( integrityManifest.options.output ) ).to.be.false;
          expect( integrityManifest.has( manifest.options.output ) ).to.be.false;

          done();
        });
      });
    });

    describe('Uses asset.info.sourceFilename when assetNames does not have a matching asset', () => {
      it('contextRelativeKeys is on', async () => {
        const { manifest, run } = create(
          configs.client(),
          {
            contextRelativeKeys: true,
          },
        );

        // Pretend like assetNames is empty.
        chai.spy.on( manifest.assetNames, 'entries', () => new Map().entries() );

        await run();

        assert.isTrue( manifest.has('test/fixtures/images/Ginger.asset.jpg') );
      });

      it('contextRelativeKeys is off', async () => {
        const { manifest, run } = create(
          configs.client(),
          {
            contextRelativeKeys: false,
          },
        );

        // Pretend like assetNames is empty.
        chai.spy.on( manifest.assetNames, 'entries', () => new Map().entries() );

        await run();

        assert.isTrue( manifest.has('Ginger.asset.jpg') );
      });
    });
  });

  describe('Errors writing file to disk', function() {
    it('has error creating directory', async () => {
      fs.chmodSync(configs.getWorkspace(), _444);

      const { run } = create(
        configs.hello(),
        undefined,
        webpack,
      );

      const error = await run().catch( error => error );

      assert.isNotNull(error, 'Permissions error not found');
      assert.equal('EACCES', error.code);

      fs.chmodSync(configs.getWorkspace(), _777);
    });

    it('has error writing file', function(done) {
      const { compiler, manifest, run } = create(
        configs.hello(),
        {
          writeToDisk: true,
        },
        webpack,
      );

      webpack_mkdirp(
        compiler.outputFileSystem,
        path.dirname(manifest.getOutputPath()),
        async err => {
          assert.isUndefined(err, 'Error found when creating directory');

          fs.writeFileSync(manifest.getOutputPath(), '', { mode: _444 });

          const error = await run().catch( error => error );

          assert.isNotNull(error, 'Permissions error not found');
          assert.equal('EACCES', error.code);

          fs.chmodSync(manifest.getOutputPath(), _777);

          done();
        },
      );
    });
  });

  describe('Usage with webpack-dev-server', function() {
    let originalEnv;
    let WebpackDevServer;

    before(() => {
      originalEnv = { ...process.env };
      WebpackDevServer = require('webpack-dev-server');
    });

    after(() => {
      process.env = originalEnv;
    });

    const getOptions = () => ({
      publicPath: '/assets/',
      quiet: true,
      noInfo: true,
      hot: true,
    });

    it('inDevServer() should return true', done => {
      const { compiler, manifest } = create(
        configs.devServer(),
        undefined,
        webpack,
      );

      const server = new WebpackDevServer(compiler, getOptions());

      server.listen(8888, 'localhost', function() {
        server.close();

        assert.isTrue(manifest.inDevServer());

        done();
      });
    });

    it('Should serve the assets manifest JSON file', done => {
      const { compiler } = create(
        configs.devServer( configs.tmpDirPath() ),
        undefined,
        webpack,
      );

      const server = new WebpackDevServer(compiler, getOptions());

      server.listen(8888, 'localhost', function() {
        superagent
          .get('http://localhost:8888/assets/assets-manifest.json')
          .end(function(err, res) {
            server.close();

            assert.isNull( err );

            assert.equal( res.status, 200 );

            assert.isAbove( res.text.length, 0, 'res.text.length is zero' );

            done();
          });
      });
    });

    it('Should write to disk using absolute output path', done => {
      const config = configs.devServer( configs.tmpDirPath() );
      const { compiler, manifest } = create(
        config,
        {
          output: path.join( config.output.path, 'manifest.json' ),
          writeToDisk: true,
        },
        webpack,
      );

      const server = new WebpackDevServer(compiler, getOptions());

      server.listen(8888, 'localhost', function() {
        superagent
          .get('http://localhost:8888/assets/manifest.json')
          .end(function(err) {
            if ( err ) {
              throw err;
            }

            server.close();

            assert.isTrue(fs.statSync(manifest.getOutputPath()).isFile());

            done();
          });
      });
    });

    it('Should write to cwd if no output paths are specified', done => {
      const { compiler, manifest } = create(
        configs.devServer(),
        {
          writeToDisk: true,
        },
        webpack,
      );

      const server = new WebpackDevServer(compiler, getOptions());

      server.listen(8888, 'localhost', function() {
        superagent
          .get('http://localhost:8888/assets/assets-manifest.json')
          .end(function(err) {
            if ( err ) {
              throw err;
            }

            server.close();

            assert.isTrue(fs.statSync(manifest.getOutputPath()).isFile());

            fs.unlinkSync(manifest.getOutputPath());

            done();
          });
      });
    });
  });

  describe('Hot module replacement', function() {
    it('Should ignore HMR files', function() {
      const config = configs.hello();

      config.output.hotUpdateChunkFilename = '[id].[hash:6].hot-update.js';

      const { manifest } = create( config );

      manifest.processAssetsByChunkName({
        main: [ 'main.123456.js', '0.123456.hot-update.js' ],
      });

      assert.equal( manifest.assetNames.get('main.js'), 'main.123456.js' );
      assert.isFalse( [ ...manifest.assetNames.values() ].includes('0.123456.hot-update.js') );
    });

    it('isHMR should return false when hotUpdateChunkFilename is ambiguous', function() {
      const config = configs.client();

      config.output.hotUpdateChunkFilename = config.output.filename;

      const { manifest } = create( config );

      assert.isFalse( manifest.isHMR('main.js') );
      assert.isFalse( manifest.isHMR('0.123456.hot-update.js') );
    });
  });

  describe('Works with css files', function() {
    it('Correct filenames are used', async () => {
      const { manifest, run } = create( configs.styles() );

      await run();

      expect( manifest.toString() ).to.contain('styles.css');
    });
  });

  describe('Works with copy-webpack-plugin', () => {
    it('Correct filenames are used', async () => {
      const { manifest, run } = create( configs.copy() );

      await run();

      expect( manifest.get('readme.md') ).to.equal('readme.md');
    });
  });

  describe('Works with compression-webpack-plugin', () => {
    it('adds gz filenames to the manifest', async () => {
      const { manifest, run } = create( configs.compression() );

      await run();

      expect( manifest.get('main.js.gz') ).to.equal('main.js.gz');
    });
  });

  describe('Works with webpack-subresource-integrity', () => {
    it('Uses integrity value from webpack-subresource-integrity plugin', async () => {
      const { manifest, run } = create(
        configs.sri(),
        {
          integrity: true,
          // When using `webpack-subresource-integrity`, this is ignored unless you
          // also specify `integrityPropertyName` as something other than `integrity`.
          integrityHashes: [ 'md5' ],
        },
      );

      await run();

      expect( manifest.get('main.js').integrity.startsWith('sha256-') ).to.be.true;
    });

    it('Uses integrity value from this plugin', async () => {
      const { manifest, run } = create(
        configs.sri(),
        {
          integrity: true,
          integrityPropertyName: 'md5',
          integrityHashes: [ 'md5' ],
        },
      );

      await run();

      expect( manifest.get('main.js').integrity.startsWith('md5-') ).to.be.true;
    });
  });
});
