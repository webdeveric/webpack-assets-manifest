var path = require('path');
var assert = require('assert');
var webpack = require('webpack');
var MemoryFs = require('memory-fs');
var WebpackAssetsManifest = require('../src/webpack-assets-manifest');

describe('WebpackAssetsManifest', function() {
  describe('#getExtension()', function () {
    var manifest = new WebpackAssetsManifest();

    it('should return the file extension', function () {
      assert.equal('.css', manifest.getExtension('main.css'));
    });

    it('should return two extensions for known formats', function () {
      assert.equal('.js.map', manifest.getExtension('main.js.map'));
      assert.equal('.css.map', manifest.getExtension('main.css.map'));
      assert.equal('.tar.gz', manifest.getExtension('archive.tar.gz'));
      assert.equal('.ext', manifest.getExtension('some.unknown.ext'));
    });

    it('should return empty string when filename is undefined or empty', function () {
      assert.equal('', manifest.getExtension());
      assert.equal('', manifest.getExtension(''));
    });

    it('should return empty string when filename does not have an extension', function () {
      assert.equal('', manifest.getExtension('no-extension'));
    });

    it('should ignore query string and fragment', function () {
      assert.equal('.js', manifest.getExtension('main.js?a=1'));
      assert.equal('.js', manifest.getExtension('main.js#b'));
      assert.equal('.js', manifest.getExtension('main.js?a=1#b'));
    });
  });

  describe('#getData()', function () {
    var manifest = new WebpackAssetsManifest();

    it('should return an object', function () {
      assert.deepEqual({}, manifest.getData());
    });
  });

  describe('#toString()', function () {
    var manifest = new WebpackAssetsManifest();

    it('should return a JSON string', function () {
      assert.equal('{}', manifest.toString());
      assert.equal('{}', manifest + '');
    });
  });

  describe('#processAssets()', function () {
    var manifest = new WebpackAssetsManifest();

    it('should process assets', function () {
      assert.deepEqual({}, manifest.moduleAssets);

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
        manifest.moduleAssets
      );
    });
  });

  describe('options.sortManifest', function () {
    var assets = {
      a: [ 'a.js' ],
      c: [ 'c.js' ],
      d: [ 'd.js' ],
      b: [ 'b.js' ]
    };

    it('should turn on sorting', function () {
      var manifest = new WebpackAssetsManifest({
        sortManifest: true
      });

      manifest.processAssets(assets);

      assert.equal('{"a.js":"a.js","b.js":"b.js","c.js":"c.js","d.js":"d.js"}',  manifest.toString());
    });

    it('should turn off sorting', function () {
      var manifest = new WebpackAssetsManifest({
        sortManifest: false
      });

      manifest.processAssets(assets);

      assert.equal('{"b.js":"b.js","d.js":"d.js","c.js":"c.js","a.js":"a.js"}',  manifest.toString());
    });

    it('should use custom comparison function', function () {
      var manifest = new WebpackAssetsManifest({
        sortManifest: function (a, b) {
          return a.localeCompare(b);
        }
      });

      manifest.processAssets(assets);

      assert.equal('{"a.js":"a.js","b.js":"b.js","c.js":"c.js","d.js":"d.js"}',  manifest.toString());
    });
  });

  describe('options.fileExtRegex', function () {
    it('should use custom RegExp', function () {
      var manifest = new WebpackAssetsManifest({
        fileExtRegex: new RegExp('\.[a-z0-9]+$', 'i')
      });

      assert.equal(manifest.getExtension('test.js'), '.js');
      assert.equal(manifest.getExtension('test.js.map'), '.map');
    });

    it('should fallback to path.extname', function () {
      var manifest = new WebpackAssetsManifest({
        fileExtRegex: false
      });

      assert.equal(manifest.getExtension('test.js'), '.js');
    });
  });

  describe('usage with Webpack', function () {
    var fs = new MemoryFs();
    var compiler = webpack({
      entry: {
        hello: path.resolve(__dirname, 'fixtures', 'hello')
      },
      output: {
        path: __dirname,
        filename: 'bundle.js'
      },
      plugins: [
        new WebpackAssetsManifest({
          output: path.join(__dirname, 'manifest.json')
        })
      ]
    });

    compiler.outputFileSystem = fs;

    it('should generate a manifest', function() {
      compiler.run(function( /* err, stats */ ) {
        var manifest = fs.readFileSync( fs.join(__dirname, 'manifest.json') );
        assert.equal('{"hello.js":"bundle.js"}', manifest.toString());
      });
    });
  });
});
