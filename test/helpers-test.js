'use strict';

const chai = require('chai');
const spies = require('chai-spies');
const { expect } = chai;

chai.use(spies);

const {
  maybeArrayWrap,
  getSRIHash,
  filterHashes,
  warn,
  varType,
  isObject,
  getSortedObject,
  templateStringToRegExp,
  findMapKeysByValue,
  group,
} = require('../src/helpers.js');

describe('Helpers', function() {
  beforeEach(() => {
    chai.spy.on(console, 'warn', () => {});
  });

  afterEach(() => {
    chai.spy.restore();
  });

  describe('maybeArrayWrap()', function() {
    it('returns input if it is an array', function() {
      const input = [ 'input' ];

      expect( maybeArrayWrap( input ) ).to.equal( input );
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

        expect( wrapped ).to.be.an('array').that.deep.equals( [ p ] );
      });
    });
  });

  describe('getSRIHash()', function() {
    it('returns SRI hash', function() {
      expect( getSRIHash([ 'sha256' ], '') ).to.equal('sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
    });

    it('starts with hash algorithm', function() {
      require('crypto').getHashes().forEach( hash => {
        expect( getSRIHash([ hash ], '').startsWith(`${hash}-`) ).to.be.true;
      });
    });

    it('returns empty if not provided an array of hash algorithms', function() {
      expect( getSRIHash('', '') ).to.be.empty;
    });
  });

  describe('filterHashes()', function() {
    it('Valid values are returned', function() {
      expect( filterHashes( [ 'sha256' ] ) ).to.be.an('array').that.includes('sha256');
    });

    it('Invalid values are filtered', function() {
      expect( filterHashes( [ 'some-fake-algorithm' ] ) ).to.be.an('array').that.does.not.include('some-fake-algorithm');
    });
  });

  describe('warn()', function() {
    it('displays a warning message', function() {
      warn('just a warning');
      expect(console.warn).to.have.been.called();
    });

    it('called once', function() {
      warn.once('once');
      warn.once('once');

      expect(console.warn).to.have.been.called.once;
    });
  });

  describe('varType()', function() {
    it('returns var data type', function() {
      const types = new Map();

      types.set( {}, 'Object' );
      types.set( Object.create(null), 'Object' );
      types.set( new (function(){})(), 'Object' );
      types.set( [], 'Array' );
      types.set( new Int8Array(), 'Int8Array' );
      types.set( Buffer.from(''), 'Uint8Array' );
      types.set( void 0, 'Undefined' );
      types.set( null, 'Null' );
      types.set( true, 'Boolean' );
      types.set( 'a', 'String' );
      types.set( 1, 'Number' );
      types.set( 3.14, 'Number' );
      types.set( () => {}, 'Function' );
      types.set( class {}, 'Function' );
      types.set( Symbol(), 'Symbol' );

      for ( const [ obj, type ] of types ) {
        expect( varType( obj ) ).to.equal( type );
      }
    });
  });

  describe('isObject()', function() {
    it('returns true when given an object', () => {
      expect( isObject( {} ) ).to.equal(true);
      expect( isObject( Object.create(null) ) ).to.equal(true);
      expect( isObject( new (class {})() ) ).to.equal(true);
    });

    it('returns false when given null', () => {
      expect( isObject( null ) ).to.equal(false);
    });
  });

  describe('getSortedObject()', function() {
    it('returns a sorted object', function() {
      const obj = {
        a: 'a',
        b: 'b',
      };

      expect( JSON.stringify( getSortedObject( obj ) ) ).to.equal('{"a":"a","b":"b"}');
      expect( JSON.stringify( getSortedObject( obj, (l, r) => l > r ? -1 : l < r ? 1 : 0 ) ) ).to.equal('{"b":"b","a":"a"}');
    });
  });

  describe('templateStringToRegExp()', function() {
    it('Builds a RegExp instance', function() {
      const regex = templateStringToRegExp('[name]-[id].[hash].js');

      expect(regex.test('demo-0.abc123.js')).to.equal(true);
    });

    it('RegExp instance has named capture groups', function() {
      const regex = templateStringToRegExp('[name]-[id].[hash].js');

      const { groups } = 'demo-0.abc123.js'.match(regex);

      expect(groups).to.include({ name: 'demo', id: '0', hash: 'abc123' });
    });

    it('Accepts a flags parameter', function() {
      const caseSensitive = templateStringToRegExp('demo.[hash].js');

      expect( caseSensitive.test('demo.abc123.js') ).to.equal(true);
      expect( caseSensitive.test('DEMO.abc123.js') ).to.equal(false);

      const caseInsensitive = templateStringToRegExp('demo.[hash].js', 'i');

      expect( caseInsensitive.test('demo.abc123.js') ).to.equal(true);
      expect( caseInsensitive.test('DEMO.abc123.js') ).to.equal(true);
    });
  });

  describe('findMapKeysByValue()', function() {
    it('finds all keys that have the corresponding value', () => {
      const data = new Map();

      data.set('Ginger', 'Eric');
      data.set('Wilson', 'Eric');
      data.set('Oliver', 'Amy');
      data.set('Andy', 'Amy');
      data.set('Francis', 'Amy');

      const findPetsFor = findMapKeysByValue( data );

      expect( findPetsFor ).to.be.a('function');
      expect( findPetsFor('Eric') ).to.be.an('array').that.include('Ginger', 'Wilson').and.to.have.lengthOf(2);
      expect( findPetsFor('Amy') ).to.be.an('array').that.include('Oliver', 'Andy', 'Francis').and.to.have.lengthOf(3);
      expect( findPetsFor('None') ).to.be.an('array').and.to.have.lengthOf(0);
    });
  });

  describe('group()', () => {
    it('group items from an array based on a callback return value', () => {
      const grouped = group(
        [ 'cat', 'dog', 'dinosaur' ],
        word => word[ 0 ],
      );

      expect( grouped ).to.deep.equal({
        c: [ 'cat' ],
        d: [ 'dog', 'dinosaur' ],
      });
    });

    it('prevent item from being grouped', () => {
      const grouped = group(
        [ 'cat', 'dog', 'dinosaur' ],
        word => word === 'cat' ? false : word[ 0 ],
      );

      expect( grouped ).to.deep.equal({
        d: [ 'dog', 'dinosaur' ],
      });
    });

    it('can modify items with a callback', () => {
      const grouped = group(
        [ 'cat', 'dog', 'dinosaur' ],
        word => word[ 0 ],
        (word, group) => `${word.toUpperCase()}-group-${group}`,
      );

      expect( grouped ).to.deep.equal({
        c: [ 'CAT-group-c' ],
        d: [ 'DOG-group-d', 'DINOSAUR-group-d' ],
      });
    });
  });
});
