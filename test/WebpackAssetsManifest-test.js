'use strict';

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const mkdirp = require('mkdirp');
const merge = require('lodash.merge');
const assert = require('chai').assert;
const rimraf = require('rimraf');
const webpack = require('webpack');
const superagent = require('superagent');
const configs = require('./fixtures/configs');
const makeCompiler = require('./fixtures/makeCompiler');
const WebpackDevServer = require('webpack-dev-server');
const WebpackAssetsManifest = require('../src/WebpackAssetsManifest');

const _444 = parseInt('0444', 8);
const _777 = parseInt('0777', 8);

console.log( chalk`Webpack version: {blueBright.bold %s}`, require('webpack/package.json').version );
console.log( chalk`Webpack dev server version: {blueBright.bold %s}`, require('webpack-dev-server/package.json').version );

describe('WebpackAssetsManifest', function() {
  before('set up', function(done) {
    mkdirp(configs.getWorkspace(), _777, function(err) {
      if (err) {
        throw err;
      }

      done();
    });
  });

  after('clean up', function(done) {
    rimraf(configs.getWorkspace(), function(err) {
      if (err) {
        throw err;
      }

      done();
    });
  });

  describe('#getExtension()', function() {
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

  describe('#toJSON()', function() {
    const manifest = new WebpackAssetsManifest();

    it('should return an object', function() {
      assert.deepEqual({}, manifest.toJSON());
      assert.equal('{}', JSON.stringify(manifest));
    });
  });

  describe('#toString()', function() {
    const manifest = new WebpackAssetsManifest();

    it('should return a JSON string', function() {
      assert.equal('{}', manifest.toString());
      assert.equal('{}', manifest + '');
    });
  });

  describe('#processAssets()', function() {
    const manifest = new WebpackAssetsManifest();

    it('should process assets', function() {
      assert.deepEqual({}, manifest.assets);

      manifest.processAssets({
        common: [
          'common-123456.js',
          'common-123456.js.map'
        ],
        main: [
          'main.123456.css',
          'main.123456.css.map'
        ]
      });

      assert.deepEqual(
        {
          'common.js': 'common-123456.js',
          'common.js.map': 'common-123456.js.map',
          'main.css': 'main.123456.css',
          'main.css.map': 'main.123456.css.map'
        },
        manifest.assets
      );
    });
  });

  describe('#getStatsData()', function() {
    it('should return statistics from webpack', function() {
      const manifest = new WebpackAssetsManifest();

      assert.throws(function() { manifest.getStatsData(); });

      assert.deepEqual( {}, manifest.getStatsData( { toJson: function() { return {}; } } ) );
    });
  });

  describe('#getOutputPath()', function() {
    it('should work with an absolute output path', function() {
      const manifest = new WebpackAssetsManifest({
        output: '/manifest.json'
      });

      manifest.apply(makeCompiler(configs.hello()));

      assert.equal('/manifest.json', manifest.getOutputPath());
    });

    it('should work with a relative output path', function() {
      const compiler = makeCompiler(configs.hello());
      const manifest = new WebpackAssetsManifest({
        output: '../manifest.json'
      });

      manifest.apply(compiler);

      assert.equal(
        path.resolve(compiler.options.output.path, '../manifest.json'),
        manifest.getOutputPath()
      );
    });

    it('should output manifest in compiler output.path by default', function() {
      const manifest = new WebpackAssetsManifest();
      const compiler = makeCompiler(configs.hello());

      manifest.apply(compiler);

      assert.equal(
        compiler.options.output.path,
        path.dirname(manifest.getOutputPath())
      );
    });

    it('should return an empty string if manifest has not been applied yet', function() {
      const manifest = new WebpackAssetsManifest();
      assert.equal('', manifest.getOutputPath());
    });
  });

  describe('#fixKey()', function() {
    it('should replace \\ with /', function() {
      const manifest = new WebpackAssetsManifest();

      assert.equal('images/Ginger.jpg', manifest.fixKey('images\\Ginger.jpg'));
    });
  });

  describe('#set()', function() {
    it('should add to manifest.assets', function() {
      const manifest = new WebpackAssetsManifest();

      assert.deepEqual({}, manifest.assets);

      manifest.set('main.js', 'main.123456.js');
      manifest.set('styles/main.css', 'styles/main.123456.css');

      assert.deepEqual(
        {
          'main.js': 'main.123456.js',
          'styles/main.css': 'styles/main.123456.css'
        },
        manifest.assets
      );
    });

    it('should transform backslashes to slashes', function() {
      const manifest = new WebpackAssetsManifest();

      assert.deepEqual({}, manifest.assets);

      manifest.set('images\\a.jpg', 'images/a.123456.jpg');

      assert.deepEqual(
        {
          'images/a.jpg': 'images/a.123456.jpg'
        },
        manifest.assets
      );
    });
  });

  describe('#has()', function() {
    it('should return a boolean', function() {
      const manifest = new WebpackAssetsManifest({
        assets: merge({}, require('./fixtures/images.json'))
      });

      assert.isTrue(manifest.has('Ginger.jpg'));
      assert.isFalse(manifest.has('dog.gif'));
    });
  });

  describe('#get()', function() {
    const manifest = new WebpackAssetsManifest({
      assets: merge({}, require('./fixtures/images.json'))
    });

    it('gets a value from the manifest', function() {
      assert.equal('images/Ginger.jpg', manifest.get('Ginger.jpg'));
    });

    it('returns a default value', function() {
      const defaultValue = 'some/default.gif';

      assert.equal(defaultValue, manifest.get('dog.gif', defaultValue));
    });

    it('returns empty string when no default value is provided', function() {
      assert.equal('', manifest.get('dog.gif'));
    });
  });

  describe('#delete()', function() {
    it('removes an asset from the manifest', function() {
      const manifest = new WebpackAssetsManifest({
        assets: merge({}, require('./fixtures/images.json'))
      });

      assert.isTrue(manifest.has('Ginger.jpg'));

      manifest.delete('Ginger.jpg');

      assert.isFalse(manifest.has('Ginger.jpg'));
    });
  });

  describe('#inDevServer()', function() {
    it('Identifies webpack-dev-server from argv', function() {
      const manifest = new WebpackAssetsManifest();

      assert.isFalse(manifest.inDevServer());

      const originalArgv = process.argv.slice(0);

      process.argv.push('webpack-dev-server');

      assert.isTrue(manifest.inDevServer());

      process.argv = originalArgv;
    });

    it('Identifies webpack-dev-server from outputFileSystem', function() {
      const config = configs.hello();
      config.output.path = '/';

      const compiler = makeCompiler(config);
      const manifest = new WebpackAssetsManifest();

      manifest.apply(compiler);

      assert.isTrue(manifest.inDevServer());
    });
  });

  describe('#pickFileByExtension()', function() {
    const files = [
      'main.js',
      'main.css',
    ];

    it('returns file with matching extension', function() {
      const manifest = new WebpackAssetsManifest();
      const file = manifest.pickFileByExtension(files, '.css', 'default');

      assert.equal(file, 'main.css');
    });

    it('returns default when no matches found', function() {
      const manifest = new WebpackAssetsManifest();
      const file = manifest.pickFileByExtension(files, '.jpg', 'default');

      assert.equal(file, 'default');
    });
  });

  describe('#processCompilationEntry()', function() {
    const comp = {
      getPath: function(t, data) {
        return data.filename;
      },
    };

    it('sets if userRequest is truthy', function(done) {
      const compiler = makeCompiler(configs.hello());
      const manifest = new WebpackAssetsManifest();

      manifest.apply(compiler);

      compiler.run(function( err ) {
        assert.isNull(err, 'Error found in compiler.run');
        const mod = {
          userRequest: 'main.js',
          chunks: [
            {
              files: [ 'main.js' ],
            },
          ],
        };

        manifest.processCompilationEntry(comp, mod);

        assert.isTrue( manifest.has('main.js') );

        done();
      });
    });

    it('supports module.getChunks() from Webpack 3', function(done) {
      const compiler = makeCompiler(configs.hello());
      const manifest = new WebpackAssetsManifest();

      manifest.apply(compiler);

      compiler.run(function( err ) {
        assert.isNull(err, 'Error found in compiler.run');
        const mod = {
          userRequest: 'main.js',
          _chunks: [
            {
              files: [ 'main.js' ],
            },
          ],
          getChunks() {
            return this._chunks;
          }
        };

        manifest.processCompilationEntry(comp, mod);

        assert.isTrue( manifest.has('main.js') );

        done();
      });
    });

    it('does not set if userRequest is falsy', function() {
      const manifest = new WebpackAssetsManifest();

      manifest.processCompilationEntry(comp, { userRequest: false });

      assert.deepEqual({}, manifest.assets);
    });
  });

  describe('options.sortManifest', function() {
    const assets = {
      a: [ 'a.js' ],
      c: [ 'c.js' ],
      d: [ 'd.js' ],
      b: [ 'b.js' ]
    };

    it('should turn on sorting', function() {
      const manifest = new WebpackAssetsManifest({
        sortManifest: true,
        space: 0
      });

      manifest.processAssets(assets);

      assert.equal(
        '{"a.js":"a.js","b.js":"b.js","c.js":"c.js","d.js":"d.js"}',
        manifest.toString()
      );
    });

    it('should turn off sorting', function() {
      const manifest = new WebpackAssetsManifest({
        sortManifest: false,
        space: 0
      });

      manifest.processAssets(assets);

      assert.equal(
        '{"b.js":"b.js","d.js":"d.js","c.js":"c.js","a.js":"a.js"}',
        manifest.toString()
      );
    });

    it('should use custom comparison function', function() {
      const manifest = new WebpackAssetsManifest({
        sortManifest: function(a, b) {
          return a.localeCompare(b);
        },
        space: 0
      });

      manifest.processAssets(assets);

      assert.equal(
        '{"a.js":"a.js","b.js":"b.js","c.js":"c.js","d.js":"d.js"}',
        manifest.toString()
      );
    });
  });

  describe('options.fileExtRegex', function() {
    it('should use custom RegExp', function() {
      const manifest = new WebpackAssetsManifest({
        fileExtRegex: /\.[a-z0-9]+$/i
      });

      assert.equal(manifest.getExtension('test.js'), '.js');
      assert.equal(manifest.getExtension('test.js.map'), '.map');
    });

    it('should fallback to path.extname', function() {
      const manifest = new WebpackAssetsManifest({
        fileExtRegex: false
      });

      assert.equal(manifest.getExtension('test.js'), '.js');
    });
  });

  describe('options.replacer', function() {
    const assets = {
      logo: [ 'images/logo.svg' ]
    };

    it('should remove all entries', function() {
      const manifest = new WebpackAssetsManifest({
        replacer: function() {
          return undefined;
        }
      });

      manifest.processAssets(assets);

      assert.equal('{}', manifest.toString());
    });

    it('should update values', function() {
      const manifest = new WebpackAssetsManifest({
        replacer: function(key, value) {
          if ( typeof value === 'string' ) {
            return value.toUpperCase();
          }

          return value;
        },
        space: 0
      });

      manifest.processAssets(assets);

      assert.equal('{"logo.svg":"IMAGES/LOGO.SVG"}', manifest.toString());
    });
  });

  describe('options.assets', function() {
    const assets = {
      logo: [ 'images/logo.svg' ]
    };

    it('should set the initial assets data', function() {
      const manifest = new WebpackAssetsManifest({
        assets: merge({}, require('./fixtures/images.json')),
        space: 0
      });

      manifest.processAssets(assets);

      assert.equal(
        '{"Ginger.jpg":"images/Ginger.jpg","logo.svg":"images/logo.svg"}',
        manifest.toString()
      );
    });

    it('should be sharable', function() {
      const sharedAssets = Object.create(null);

      const manifest1 = new WebpackAssetsManifest({
        assets: sharedAssets
      });

      const manifest2 = new WebpackAssetsManifest({
        assets: sharedAssets
      });

      manifest1.processAssets({
        main: [ 'main.js' ]
      });

      manifest2.processAssets({
        subpage: [ 'subpage.js' ]
      });

      assert.equal(manifest1.toString(), manifest2.toString());
    });
  });

  describe('options.merge', function() {

    function setupManifest(compiler, manifest)
    {
      return new Promise( (resolve, reject) => {
        manifest.apply(compiler);

        mkdirp(
          path.dirname(manifest.getOutputPath()),
          err => {
            if ( err ) {
              reject( err );
              return;
            }

            try {
              fs.copySync( path.resolve(__dirname, 'fixtures/sample-manifest.json'), manifest.getOutputPath());
              resolve({ compiler, manifest });
            } catch (err) {
              reject(err);
            }
          }
        );
      });
    }

    it('should merge data if output file exists', function(done) {
      const compiler = makeCompiler(configs.hello());

      const manifest = new WebpackAssetsManifest({
        merge: true,
        space: 0,
      });

      setupManifest(compiler, manifest).then( () => {
        compiler.run(function( err ) {
          assert.isNull(err, 'Error found in compiler.run');

          assert.equal(
            '{"Ginger.jpg":"images/Ginger.jpg","main.js":"bundle.js"}',
            manifest.toString()
          );

          done();
        });
      });
    });

    it('can customize during merge', function(done) {
      const mergingResults = [];
      const compiler = makeCompiler(configs.hello());
      const manifest = new WebpackAssetsManifest({
        merge: 'customize',
        space: 0,
        customize(key, value, originalValue, manifest) {
          assert.isBoolean(manifest.isMerging);
          mergingResults.push(manifest.isMerging);
        }
      });

      setupManifest(compiler, manifest).then( () => {
        compiler.run(function( err ) {
          assert.isNull(err, 'Error found in compiler.run');
          assert.isTrue( mergingResults.some( r => r === true ) );
          assert.isTrue( mergingResults.some( r => r === false ) );

          done();
        });
      });
    });

    it('merge skips #customize()', function(done) {
      let customizeCalled = false;
      const compiler = makeCompiler(configs.hello());
      const manifest = new WebpackAssetsManifest({
        merge: true,
        customize(key, value, originalValue, manifest) {
          if ( manifest.isMerging ) {
            customizeCalled = true;
          }
        }
      });

      setupManifest(compiler, manifest).then( () => {
        compiler.run(function( err ) {
          assert.isNull(err, 'Error found in compiler.run');
          assert.isFalse( customizeCalled );

          done();
        });
      });
    });
  });

  describe('options.publicPath', function() {
    const img = 'images/photo.jpg';
    const cdn = {
      default: 'https://cdn.example.com/',
      images: 'https://img-cdn.example.com/'
    };

    it('can be a string', function() {
      const manifest = new WebpackAssetsManifest({
        publicPath: 'assets/',
      });

      manifest.set('hello', 'world');
      assert.equal( manifest.get('hello') , 'assets/world' );
    });

    it('can be true', function(done) {
      const config = configs.hello();
      config.output.publicPath = cdn.default;

      const compiler = makeCompiler(config);
      const manifest = new WebpackAssetsManifest({
        publicPath: true,
      });

      manifest.apply(compiler);

      compiler.run(function( err ) {
        assert.isNull(err, 'Error found in compiler.run');
        assert.equal( cdn.default + 'bundle.js', manifest.get('main.js') );
        done();
      });
    });

    it('has no affect if false', function(done) {
      const config = configs.hello();
      config.output.publicPath = cdn.default;

      const compiler = makeCompiler(config);
      const manifest = new WebpackAssetsManifest({
        publicPath: false,
      });

      manifest.apply(compiler);

      compiler.run(function( err ) {
        assert.isNull(err, 'Error found in compiler.run');
        assert.equal('bundle.js', manifest.get('main.js') );
        done();
      });
    });

    it('only prefixes strings', function() {
      const manifest = new WebpackAssetsManifest({
        publicPath: cdn.default
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
        }
      });

      assert.isFunction( manifest.options.publicPath );

      manifest.set( img, img );

      assert.equal( cdn.images + img, manifest.get( img ) );
    });
  });

  describe('options.contextRelativeKeys', function() {
    it('asset key is relative to the context', function(done) {
      const compiler = webpack(configs.client());
      const manifest = new WebpackAssetsManifest({
        contextRelativeKeys: true
      });

      manifest.apply(compiler);

      compiler.run(function( err ) {
        assert.isNull(err, 'Error found in compiler.run');
        fs.readFile(
          manifest.getOutputPath(),
          function(err) {
            assert.isNull(err, 'Error found reading manifest.json');
            assert.isFalse(manifest.has('Ginger.jpg'));
            assert.isTrue(manifest.has('test/fixtures/Ginger.jpg'));
            assert.equal(manifest.get('test/fixtures/Ginger.jpg'), 'images/Ginger.jpg');

            done();
          }
        );
      });
    });
  });

  describe('options.customize', function() {
    it('customizes the key and value', function() {
      const manifest = new WebpackAssetsManifest({
        customize: function(key, value) {
          return {
            key: key.toUpperCase(),
            value: value.toUpperCase(),
          };
        },
      });

      manifest.set('hello', 'world');

      assert.isTrue( manifest.has('HELLO') );
      assert.isFalse( manifest.has('hello') );
    });

    it('customizes the key', function() {
      const manifest = new WebpackAssetsManifest({
        customize: function(key) {
          return {
            key: key.toUpperCase(),
          };
        },
      });

      manifest.set('hello', 'world');

      assert.isTrue( manifest.has('HELLO') );
      assert.isFalse( manifest.has('hello') );
      assert.equal( manifest.get('HELLO'), 'world' );
    });

    it('customizes the value', function() {
      const manifest = new WebpackAssetsManifest({
        customize: function(key, value) {
          return {
            value: value.toUpperCase(),
          };
        },
      });

      manifest.set('hello', 'world');

      assert.isFalse( manifest.has('HELLO') );
      assert.isTrue( manifest.has('hello') );
      assert.equal( manifest.get('hello'), 'WORLD' );
    });

    it('has no affect if nothing is returned', function() {
      const manifest = new WebpackAssetsManifest({
        customize: function() {
        },
      });

      manifest.set('hello', 'world');

      assert.isTrue( manifest.has('hello') );
      assert.equal( manifest.get('hello'), 'world' );
    });

    it('skips adding asset if false is returned', function() {
      const manifest = new WebpackAssetsManifest({
        customize: function() {
          return false;
        },
      });

      manifest.set('hello', 'world');

      assert.isFalse( manifest.has('hello') );
      assert.deepEqual( {}, manifest.assets );
    });
  });

  describe('usage with webpack', function() {
    it('writes to disk', function(done) {
      const compiler = makeCompiler(configs.hello());
      const manifest = new WebpackAssetsManifest({
        writeToDisk: true
      });

      manifest.apply(compiler);

      compiler.run(function( err ) {
        assert.isNull(err, 'Error found in compiler.run');

        fs.readFile(
          manifest.getOutputPath(),
          function(err, content) {
            assert.isNull(err, 'Error found reading manifest.json');

            assert.equal(manifest.toString(), content.toString());

            done();
          }
        );
      });
    });

    it('compiler has error if unable to create directory', function(done) {
      const compiler = makeCompiler(configs.hello());
      const manifest = new WebpackAssetsManifest({
        writeToDisk: true,
        apply() {
          fs.chmodSync(configs.getWorkspace(), _444);
        }
      });

      manifest.apply(compiler);

      compiler.run(function( err ) {
        assert.isNotNull(err, 'Permissions error not found');
        assert.equal('EACCES', err.code);

        fs.chmodSync(configs.getWorkspace(), _777);

        done();
      });
    });

    it('finds module assets', function(done) {
      const compiler = webpack(configs.client());
      const manifest = new WebpackAssetsManifest();

      manifest.apply(compiler);

      compiler.run(function( err ) {
        assert.isNull(err, 'Error found in compiler.run');
        fs.readFile(
          manifest.getOutputPath(),
          function(err, content) {
            assert.isNull(err, 'Error found reading manifest.json');

            assert.include(content.toString(), 'images/Ginger.jpg');

            done();
          }
        );
      });
    });

    it('should support multi compiler mode', function(done) {
      let manifestPath = null;
      const assets = Object.create(null);
      const multiConfig = configs.multi().map(function(config) {
        config.plugins = [
          new WebpackAssetsManifest({
            assets,
          })
        ];

        manifestPath = path.join( config.output.path, 'manifest.json' );

        return config;
      });

      webpack(multiConfig, function( err ) {
        assert.isNull(err, 'Error found in compiler.run');

        fs.readFile(
          manifestPath,
          function(err, content) {
            assert.isNull(err, 'Error found reading manifest.json');
            assert.include(content.toString(), 'client.js');
            assert.include(content.toString(), 'server.js');
            assert.include(content.toString(), 'images/Ginger.jpg');

            done();
          }
        );
      });
    });
  });

  describe('Setting event listeners', function() {
    function noop() {}

    it('allows adding event listeners from options', function() {
      const options = {
        moduleAsset: noop,
        processAssets: noop,
        done: noop
      };

      const manifest = new WebpackAssetsManifest(options);

      Object.keys(options).forEach(function(listener) {
        assert.equal(1, manifest.listeners(listener).length);
      });
    });

    it('uses on and emit', function(done) {
      new WebpackAssetsManifest({
        apply: function() {
          done();
        }
      }).apply( makeCompiler( configs.hello() ) );
    });
  });

  describe('Errors writing file to disk', function() {
    it('has error creating directory', function(done) {
      fs.chmodSync(configs.getWorkspace(), _444);

      const compiler = webpack(configs.hello());
      const manifest = new WebpackAssetsManifest({
        writeToDisk: true
      });

      manifest.apply(compiler);

      compiler.run(function( err ) {
        assert.isNotNull(err, 'Permissions error not found');
        assert.equal('EACCES', err.code);

        fs.chmodSync(configs.getWorkspace(), _777);

        done();
      });
    });

    it('has error writing file', function(done) {
      const compiler = webpack(configs.hello());
      const manifest = new WebpackAssetsManifest({
        writeToDisk: true
      });

      manifest.apply(compiler);

      compiler.outputFileSystem.mkdirp(
        path.dirname(manifest.getOutputPath()),
        function(err) {
          assert.isNull(err, 'Error found when creating directory');

          fs.writeFileSync(manifest.getOutputPath(), '', { mode: _444 });

          compiler.run(function( err ) {
            assert.isNotNull(err, 'Permissions error not found');
            assert.equal('EACCES', err.code);

            fs.chmodSync(manifest.getOutputPath(), _777);

            done();
          });
        }
      );
    });
  });

  describe('Usage with webpack-dev-server', function() {

    const getOptions = () => ({
      publicPath: '/assets/',
      quiet: true,
      noInfo: true,
    });

    it('#inDevServer() should return true', function(done) {
      const compiler = makeCompiler(configs.devServer());
      const manifest = new WebpackAssetsManifest();

      manifest.apply(compiler);

      const server = new WebpackDevServer(compiler, getOptions());

      server.listen(8888, 'localhost', function() {
        assert.isTrue(manifest.inDevServer());

        server.close();

        done();
      });
    });

    it('Should serve /assets/manifest.json', function(done) {
      const compiler = makeCompiler(configs.devServer());
      const manifest = new WebpackAssetsManifest();

      manifest.apply(compiler);

      const server = new WebpackDevServer(compiler, getOptions());

      server.listen(8888, 'localhost', function() {
        superagent
          .get('http://localhost:8888/assets/manifest.json')
          .end(function(err, res) {
            if ( err ) {
              throw err;
            }

            assert( JSON.parse(res.text) );

            server.close();

            done();
          });
      });
    });

    it('Should write to disk using absolute output path', function(done) {
      const config = configs.devServer( configs.tmpDirPath() );

      const compiler = makeCompiler(config);
      const manifest = new WebpackAssetsManifest({
        output: path.join( config.output.path, 'manifest.json' ),
        writeToDisk: true
      });

      manifest.apply(compiler);

      const server = new WebpackDevServer(compiler, getOptions());

      server.listen(8888, 'localhost', function() {
        superagent
          .get('http://localhost:8888/assets/manifest.json')
          .end(function(err) {
            if ( err ) {
              throw err;
            }

            assert.isTrue(fs.statSync(manifest.getOutputPath()).isFile());

            server.close();

            done();
          });
      });
    });

    it('Should write to cwd if no output paths are specified', function(done) {
      const config = configs.devServer();
      const compiler = makeCompiler(config);
      const manifest = new WebpackAssetsManifest({
        writeToDisk: true
      });

      manifest.apply(compiler);

      const server = new WebpackDevServer(compiler, getOptions());

      server.listen(8888, 'localhost', function() {
        superagent
          .get('http://localhost:8888/assets/manifest.json')
          .end(function(err) {
            if ( err ) {
              throw err;
            }

            assert.isTrue(fs.statSync(manifest.getOutputPath()).isFile());

            fs.unlinkSync(manifest.getOutputPath());

            server.close();

            done();
          });
      });
    });
  });

  describe('Hot module replacement', function() {
    it('Should ignore HMR files', function() {
      const manifest = new WebpackAssetsManifest();
      const config = configs.hello();

      config.output.hotUpdateChunkFilename = '[id].[hash:6].hot-update.js';

      manifest.apply(makeCompiler(config));

      manifest.processAssets({
        main: [
          'main.123456.js',
          '0.123456.hot-update.js'
        ]
      });

      assert.deepEqual(
        {
          'main.js': 'main.123456.js'
        },
        manifest.assets
      );
    });

    it('Should ignore HMR module assets', function() {
      const compiler = makeCompiler(configs.client());
      const manifest = new WebpackAssetsManifest();

      manifest.apply(compiler);
      manifest.handleModuleAsset({ userRequest: '' }, '0.123456.hot-update.js');

      assert.deepEqual( {}, manifest.assets );
    });

    it('isHMR should return false when hotUpdateChunkFilename is ambiguous', function() {
      const manifest = new WebpackAssetsManifest();
      const config = configs.client();

      config.output.hotUpdateChunkFilename = config.output.filename;

      manifest.apply(makeCompiler(config));

      assert.isFalse( manifest.isHMR('main.js') );
      assert.isFalse( manifest.isHMR('0.123456.hot-update.js') );
    });
  });
});
