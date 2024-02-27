import type { KeyValuePair, UnknownRecord } from './types.js';

/**
 * Determine if the input is an `Object`.
 *
 * @public
 */
export function isObject<T extends object = UnknownRecord>(input: unknown): input is T {
  return input !== null && typeof input === 'object' && !Array.isArray(input);
}

/**
 * Determine if the input is a `KeyValuePair`.
 *
 * @public
 */
export function isKeyValuePair(input: unknown): input is KeyValuePair {
  return isObject(input) && (Object.hasOwn(input, 'key') || Object.hasOwn(input, 'value'));
}

/**
 * Determine if the input is a `PropertyKey`.
 *
 * @public
 */
export function isPropertyKey(input: unknown): input is PropertyKey {
  return typeof input === 'string' || typeof input === 'number' || typeof input === 'symbol';
}
