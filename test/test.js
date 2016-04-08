var assert = require('assert');
var WebpackAssetsManifest = require('../src/webpack-assets-manifest');

describe('WebpackAssetsManifest', function() {
  describe('#getExtension()', function () {
    var manifest = new WebpackAssetsManifest();

    it('should return the file extension', function () {
      assert.equal('.css', manifest.getExtension('main.css'));
    });

    it('should return the file extensions when num is provided', function () {
      assert.equal('.tar.gz', manifest.getExtension('archive.tar.gz', 2));
      assert.equal('.html.tar.gz', manifest.getExtension('archive.html.tar.gz', 3));
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
          'common-123456.ext.ext'
        ]
      });

      assert.deepEqual(
        {
          'common.js': 'common-123456.js',
          'common.ext.ext': 'common-123456.ext.ext'
        },
        manifest.moduleAssets
      );
    });
  });
});
