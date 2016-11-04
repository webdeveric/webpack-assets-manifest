var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var merge = require('lodash.merge');
var assert = require('chai').assert;
var rimraf = require('rimraf');
var webpack = require('webpack');
var superagent = require('superagent');
var configs = require('./fixtures/configs');
var makeCompiler = require('./fixtures/makeCompiler');
var WebpackDevServer = require('webpack-dev-server');
var WebpackAssetsManifest = require('../src/WebpackAssetsManifest');

describe('WebpackAssetsManifest', function() {
  before('set up', function(done) {
    mkdirp(configs.getWorkspace(), function() {
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
    var manifest = new WebpackAssetsManifest();

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
    var manifest = new WebpackAssetsManifest();

    it('should return an object', function() {
      assert.deepEqual({}, manifest.toJSON());
      assert.equal('{}', JSON.stringify(manifest));
    });
  });

  describe('#toString()', function() {
    var manifest = new WebpackAssetsManifest();

    it('should return a JSON string', function() {
      assert.equal('{}', manifest.toString());
      assert.equal('{}', manifest + '');
    });
  });

  describe('#processAssets()', function() {
    var manifest = new WebpackAssetsManifest();

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
      var manifest = new WebpackAssetsManifest();

      assert.throws(function() { manifest.getStatsData(); });

      assert.deepEqual( {}, manifest.getStatsData( { toJson: function() { return {}; } } ) );
    });
  });

  describe('#getOutputPath()', function() {
    it('should work with an absolute output path', function() {
      var manifest = new WebpackAssetsManifest({
        output: '/manifest.json'
      });

      manifest.apply(makeCompiler(configs.hello()));

      assert.equal('/manifest.json', manifest.getOutputPath());
    });

    it('should work with a relative output path', function() {
      var compiler = makeCompiler(configs.hello());
      var manifest = new WebpackAssetsManifest({
        output: '../manifest.json'
      });

      manifest.apply(compiler);

      assert.equal(
        path.resolve(compiler.options.output.path, '../manifest.json'),
        manifest.getOutputPath()
      );
    });

    it('should output manifest in compiler output.path by default', function() {
      var manifest = new WebpackAssetsManifest();
      var compiler = makeCompiler(configs.hello());

      manifest.apply(compiler);

      assert.equal(
        compiler.options.output.path,
        path.dirname(manifest.getOutputPath())
      );
    });

    it('should return an empty string if manifest has not been applied yet', function() {
      var manifest = new WebpackAssetsManifest();
      assert.equal('', manifest.getOutputPath());
    });
  });

  describe('#fixKey()', function() {
    it('should replace \\ with /', function() {
      var manifest = new WebpackAssetsManifest();

      assert.equal('images/Ginger.jpg', manifest.fixKey('images\\Ginger.jpg'));
    });
  });

  describe('#set()', function() {
    it('should add to manifest.assets', function() {
      var manifest = new WebpackAssetsManifest();

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
      var manifest = new WebpackAssetsManifest();

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
      var manifest = new WebpackAssetsManifest({
        assets: merge({}, require('./fixtures/images.json'))
      });

      assert.isTrue(manifest.has('Ginger.jpg'));
      assert.isFalse(manifest.has('dog.gif'));
    });
  });

  describe('#get()', function() {
    var manifest = new WebpackAssetsManifest({
      assets: merge({}, require('./fixtures/images.json'))
    });

    it('gets a value from the manifest', function() {
      assert.equal('images/Ginger.jpg', manifest.get('Ginger.jpg'));
    });

    it('returns a default value', function() {
      var defaultValue = 'some/default.gif';

      assert.equal(defaultValue, manifest.get('dog.gif', defaultValue));
    });

    it('returns empty string when no default value is provided', function() {
      assert.equal('', manifest.get('dog.gif'));
    });
  });

  describe('#delete()', function() {
    it('removes an asset from the manifest', function() {
      var manifest = new WebpackAssetsManifest({
        assets: merge({}, require('./fixtures/images.json'))
      });

      assert.isTrue(manifest.has('Ginger.jpg'));

      manifest.delete('Ginger.jpg');

      assert.isFalse(manifest.has('Ginger.jpg'));
    });
  });

  describe('#inDevServer()', function() {
    it('Identifies webpack-dev-server from argv', function() {
      var manifest = new WebpackAssetsManifest();

      assert.isFalse(manifest.inDevServer());

      var originalArgv = process.argv.slice(0);

      process.argv.push('webpack-dev-server');

      assert.isTrue(manifest.inDevServer());

      process.argv = originalArgv;
    });

    it('Identifies webpack-dev-server from outputFileSystem', function() {
      var config = configs.hello();
      config.output.path = '/';

      var compiler = makeCompiler(config);
      var manifest = new WebpackAssetsManifest();

      manifest.apply(compiler);

      assert.isTrue(manifest.inDevServer());
    });
  });

  describe('options.emit', function() {
    it('has been deprecated - use writeToDisk instead', function() {
      var manifest = new WebpackAssetsManifest({
        emit: false
      });

      assert.isTrue(manifest.options.writeToDisk);
      assert.isUndefined(manifest.options.emit);
    });
  });

  describe('options.sortManifest', function() {
    var assets = {
      a: [ 'a.js' ],
      c: [ 'c.js' ],
      d: [ 'd.js' ],
      b: [ 'b.js' ]
    };

    it('should turn on sorting', function() {
      var manifest = new WebpackAssetsManifest({
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
      var manifest = new WebpackAssetsManifest({
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
      var manifest = new WebpackAssetsManifest({
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
      var manifest = new WebpackAssetsManifest({
        fileExtRegex: new RegExp('\.[a-z0-9]+$', 'i')
      });

      assert.equal(manifest.getExtension('test.js'), '.js');
      assert.equal(manifest.getExtension('test.js.map'), '.map');
    });

    it('should fallback to path.extname', function() {
      var manifest = new WebpackAssetsManifest({
        fileExtRegex: false
      });

      assert.equal(manifest.getExtension('test.js'), '.js');
    });
  });

  describe('options.replacer', function() {
    var assets = {
      logo: [ 'images/logo.svg' ]
    };

    it('should remove all entries', function() {
      var manifest = new WebpackAssetsManifest({
        replacer: function() {
          return undefined;
        }
      });

      manifest.processAssets(assets);

      assert.equal('{}', manifest.toString());
    });

    it('should update values', function() {
      var manifest = new WebpackAssetsManifest({
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
    var assets = {
      logo: [ 'images/logo.svg' ]
    };

    it('should set the initial assets data', function() {
      var manifest = new WebpackAssetsManifest({
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
      var sharedAssets = Object.create(null);

      var manifest1 = new WebpackAssetsManifest({
        assets: sharedAssets
      });

      var manifest2 = new WebpackAssetsManifest({
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
    it('should attempt to merge data', function(done) {
      var compiler = makeCompiler(configs.hello());
      var manifest = new WebpackAssetsManifest({
        merge: true
      });

      manifest.apply(compiler);

      compiler.run(function( err ) {
        assert.isNull(err, 'Error found in compiler.run');
        done();
      });
    });

    it('should merge data if output file exists', function(done) {
      var compiler = webpack(configs.hello());
      var manifest = new WebpackAssetsManifest({
        merge: true,
        space: 0
      });

      manifest.apply(compiler);

      compiler.outputFileSystem.mkdirp(
        path.dirname(manifest.getOutputPath()),
        function(err) {
          assert.isNull(err, 'Error found when creating directory');

          compiler.outputFileSystem.writeFile(
            manifest.getOutputPath(),
            JSON.stringify( require('./fixtures/sample-manifest.json') ),
            function(err) {
              assert.isNull(err, 'Error found when creating file');

              compiler.run(function( err ) {
                assert.isNull(err, 'Error found in compiler.run');

                assert.equal(
                  '{"Ginger.jpg":"images/Ginger.jpg","main.js":"bundle.js"}',
                  manifest.toString()
                );

                done();
              });
            }
          );
        }
      );
    });
  });

  describe('usage with webpack', function() {
    it('writes to disk', function(done) {
      var compiler = makeCompiler(configs.hello());
      var manifest = new WebpackAssetsManifest({
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

    it('finds module assets', function(done) {
      var compiler = webpack(configs.client());
      var manifest = new WebpackAssetsManifest();

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
      var assets = Object.create(null);
      var manifestPath = null;
      var multiConfig = configs.multi().map(function(config) {
        config.plugins = [
          new WebpackAssetsManifest({
            assets: assets
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
            assert.include(content.toString(), 'client-bundle.js');
            assert.include(content.toString(), 'server-bundle.js');
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
      var options = {
        moduleAsset: noop,
        processAssets: noop,
        done: noop
      };

      var manifest = new WebpackAssetsManifest(options);

      Object.keys(options).forEach(function(listener) {
        assert.equal(1, manifest.listeners(listener).length);
      });
    });

    it('uses on and emit', function(done) {
      new WebpackAssetsManifest({
        apply: function() {
          done();
        }
      }).apply({ plugin: noop });
    });
  });

  describe('Errors writing file to disk', function() {
    var _444 = parseInt('0444', 8);
    var _777 = parseInt('0777', 8);

    it('has error creating directory', function(done) {
      fs.chmodSync(configs.getWorkspace(), _444);

      var compiler = webpack(configs.hello());
      var manifest = new WebpackAssetsManifest({
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
      var compiler = webpack(configs.hello());
      var manifest = new WebpackAssetsManifest({
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

    var options = {
      publicPath: '/assets/',
      quiet: true,
      noInfo: true,
    };

    it('#inDevServer() should return true', function(done) {
      var compiler = makeCompiler(configs.devServer());
      var manifest = new WebpackAssetsManifest();

      manifest.apply(compiler);

      var server = new WebpackDevServer(compiler, options);

      server.listen(8888, 'localhost', function() {
        assert.isTrue(manifest.inDevServer());

        server.close();

        done();
      });
    });

    it('Should serve /assets/manifest.json', function(done) {
      var compiler = makeCompiler(configs.devServer());
      var manifest = new WebpackAssetsManifest();

      manifest.apply(compiler);

      var server = new WebpackDevServer(compiler, options);

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
      var config = configs.devServer( configs.tmpDirPath() );

      var compiler = makeCompiler(config);
      var manifest = new WebpackAssetsManifest({
        output: path.join( config.output.path, 'manifest.json' ),
        writeToDisk: true
      });

      manifest.apply(compiler);

      var server = new WebpackDevServer(compiler, options);

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
      var config = configs.devServer();
      var compiler = makeCompiler(config);
      var manifest = new WebpackAssetsManifest({
        writeToDisk: true
      });

      manifest.apply(compiler);

      var server = new WebpackDevServer(compiler, options);

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
});
