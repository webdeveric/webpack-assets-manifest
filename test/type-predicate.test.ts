import { describe, expect, it } from 'vitest';

import { isKeyValuePair, isObject, isPropertyKey } from '../src/type-predicate.js';

describe('isObject()', function () {
  it('returns true when given an object', () => {
    expect(isObject({})).toBeTruthy();
    expect(isObject(Object.create(null))).toBeTruthy();
    expect(isObject(new (class {})())).toBeTruthy();
  });

  it('returns false when given null', () => {
    expect(isObject(null)).toBeFalsy();
  });
});

describe('isKeyValuePair()', () => {
  it('Returns true for valid input', () => {
    expect(
      isKeyValuePair({
        key: 'key',
        value: 'value',
      }),
    ).toBeTruthy();

    expect(
      isKeyValuePair({
        key: 'key',
      }),
    ).toBeTruthy();

    expect(
      isKeyValuePair({
        value: 'value',
      }),
    ).toBeTruthy();

    expect(isKeyValuePair(false)).toBeFalsy();
  });
});

describe('isPropertyKey()', () => {
  it.each(['string-key', 123, Symbol('symbol-key')])('Returns true for %s', (input) => {
    expect(isPropertyKey(input)).toBeTruthy();
  });

  it.each([false, null, undefined, {}, []])('Returns false for %s', (input) => {
    expect(isPropertyKey(input)).toBeFalsy();
  });
});
