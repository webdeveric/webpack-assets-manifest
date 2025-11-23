import { createHash, type BinaryLike } from 'node:crypto';

import { isPropertyKey } from './type-predicate.js';

export function asArray<T>(data: T | T[]): T[] {
  return Array.isArray(data) ? data : [data];
}

/**
 * See {@link https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity | Subresource Integrity} at MDN
 *
 * @public
 */
export function getSRIHash(algorithm: string, content: string | BinaryLike): string {
  return `${algorithm}-${createHash(algorithm).update(content).digest('base64')}`;
}

/**
 * Get an object sorted by keys.
 *
 * @internal
 */
export function getSortedObject(
  object: Record<string, unknown>,
  compareFunction?: (left: string, right: string) => number,
): typeof object {
  return Object.fromEntries(
    Object.entries(object).sort(compareFunction ? (left, right) => compareFunction(left[0], right[0]) : undefined),
  );
}

/**
 * Find a Map entry key by the value
 *
 * @internal
 */
export function findMapKeysByValue<K = string, V = string>(map: Map<K, V>): (searchValue: V) => K[] {
  const entries = [...map.entries()];

  return (searchValue: V): K[] => entries.filter(([, value]) => value === searchValue).map(([name]) => name);
}

/**
 * Group items from an array based on a callback return value.
 *
 * @internal
 */
export function group<T>(
  data: readonly T[],
  getGroup: (item: T) => PropertyKey | undefined,
  mapper?: (item: T, group: PropertyKey) => T,
): Record<PropertyKey, T[]> {
  return data.reduce((obj, item) => {
    const group = getGroup(item);

    if (isPropertyKey(group)) {
      (obj[group] ??= []).push(mapper ? mapper(item, group) : item);
    }

    return obj;
  }, Object.create(null));
}
