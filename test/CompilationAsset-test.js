'use strict';

const assert = require('chai').assert;
const CompilationAsset = require('../src/CompilationAsset');

describe('CompilationAsset', function() {
  const content = 'Hello, World!';

  describe('#constructor()', function() {
    it('throws when you omit the content arg', function() {
      assert.throws(function() {
        new CompilationAsset();
      });
    });

    it('sets the content', function() {
      const asset = new CompilationAsset(content);

      assert.equal(content, asset.content);
    });
  });

  describe('#source()', function() {
    it('returns the content', function() {
      const asset = new CompilationAsset(content);

      assert.equal(content, asset.source());
    });
  });

  describe('#size()', function() {
    it('returns length of the content', function() {
      const asset = new CompilationAsset(content);

      assert.equal(content.length, asset.size());
    });
  });
});
