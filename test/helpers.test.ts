import { describe, expect, it } from 'vitest';

import { asArray, getSortedObject, findMapKeysByValue, group, getLockFilename, getSRIHash } from '../src/helpers.js';

describe('getLockFilename()', () => {
  it('Returns the sanitized filename with a .lock suffix', () => {
    expect(
      getLockFilename('/some-path/asset-manifest.json').endsWith('some-path-asset-manifest-json.lock'),
    ).toBeTruthy();
  });
});

describe('asArray()', function () {
  it('returns input if it is an array', () => {
    const input = ['input'];

    expect(asArray(input)).toEqual(input);
  });

  it('wraps non array input with an array', () => {
    expect(asArray(true)).toEqual([true]);
  });
});

describe('getSRIHash()', function () {
  it('Returns SRI hash', function () {
    expect(getSRIHash('sha256', '')).toEqual('sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
  });

  it('Throws when provided an invalid hash algorithm', function () {
    expect(() => getSRIHash('bad-algorithm', '')).toThrow();
  });
});

describe('getSortedObject()', function () {
  it('returns a sorted object', function () {
    const obj = {
      a: 'a',
      b: 'b',
    };

    expect(JSON.stringify(getSortedObject(obj))).toEqual('{"a":"a","b":"b"}');
    expect(JSON.stringify(getSortedObject(obj, (left, right) => (left > right ? -1 : left < right ? 1 : 0)))).toEqual(
      '{"b":"b","a":"a"}',
    );
  });
});

describe('findMapKeysByValue()', function () {
  it('finds all keys that have the corresponding value', () => {
    const data = new Map();

    data.set('Ginger', 'Eric');
    data.set('Wilson', 'Eric');
    data.set('Oliver', 'Amy');
    data.set('Andy', 'Amy');
    data.set('Francis', 'Amy');

    const findPetsFor = findMapKeysByValue(data);

    expect(findPetsFor).toBeInstanceOf(Function);
    expect(findPetsFor('Eric')).toEqual(expect.arrayContaining(['Ginger', 'Wilson']));
    expect(findPetsFor('Amy')).toEqual(expect.arrayContaining(['Oliver', 'Andy', 'Francis']));
    expect(findPetsFor('None')).toHaveLength(0);
  });
});

describe('group()', () => {
  it('group items from an array based on a callback return value', () => {
    const grouped = group(['cat', 'dog', 'dinosaur'], (word) => word[0]);

    expect(grouped).toEqual({
      c: ['cat'],
      d: ['dog', 'dinosaur'],
    });
  });

  it('prevent item from being grouped', () => {
    const grouped = group(['cat', 'dog', 'dinosaur'], (word) => (word === 'cat' ? undefined : word[0]));

    expect(grouped).toEqual({
      d: ['dog', 'dinosaur'],
    });
  });

  it('can modify items with a callback', () => {
    const grouped = group(
      ['cat', 'dog', 'dinosaur'],
      (word) => word[0],
      (word, group) => `${word.toUpperCase()}-group-${String(group)}`,
    );

    expect(grouped).toEqual({
      c: ['CAT-group-c'],
      d: ['DOG-group-d', 'DINOSAUR-group-d'],
    });
  });
});
