var assert = require('chai').assert;
var CompilationAsset = require('../src/CompilationAsset');

describe('CompilationAsset', function() {
  var content = 'Hello, World!';

  describe('#constructor()', function() {
    it('throws when you omit the content arg', function() {
      assert.throws(function() {
        new CompilationAsset();
      });
    });

    it('sets the content', function() {
      var asset = new CompilationAsset(content);

      assert.equal(content, asset.content);
    });
  });

  describe('#source()', function() {
    it('returns the content', function() {
      var asset = new CompilationAsset(content);

      assert.equal(content, asset.source());
    });
  });

  describe('#size()', function() {
    it('returns length of the content', function() {
      var asset = new CompilationAsset(content);

      assert.equal(content.length, asset.size());
    });
  });
});
