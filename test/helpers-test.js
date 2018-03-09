'use strict';

const assert = require('chai').assert;
const { maybeArrayWrap, getSRIHash } = require('../src/helpers');

describe('helpers', function() {
  describe('maybeArrayWrap', function() {
    it('returns input if it is an array', function() {
      const input = ['input'];

      assert.strictEqual( input, maybeArrayWrap( input ) );
    });

    it('wraps non array input with an array', function() {
      const primitives = [
        'a',
        1,
        true,
        null,
        undefined,
        Symbol(),
      ];

      primitives.forEach( p => {
        const wrapped = maybeArrayWrap( p );

        assert.isArray( wrapped );
        assert.deepEqual([ p ], wrapped );
      });
    });
  });

  describe('getSRIHash', function() {
    it('returns SRI hash', function() {
      const hash = getSRIHash(['sha256'], '');

      assert.equal('sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=', hash );
    });

    it('starts with hash algorithm', function() {
      require('crypto').getHashes().forEach( hash => {
        assert.isTrue( getSRIHash([ hash ], '').startsWith(`${hash}-`) );
      });
    });

    it('returns empty if not provided an array of hash algorithms', function() {
      assert.isEmpty( getSRIHash('', '') );
    });
  });
});
