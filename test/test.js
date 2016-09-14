var assert = require('assert');
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
});
