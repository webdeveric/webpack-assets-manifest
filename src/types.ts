/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * @public
 */
export type AnyRecord = Record<PropertyKey, any>;

/**
 * @public
 */
export type UnknownRecord = Record<PropertyKey, unknown>;

/**
 * @public
 */
export type AssetsStorage = Record<string | number, any>;

/**
 * @public
 */
export type AssetsStorageKey = keyof AssetsStorage;

/**
 * @public
 */
export type AssetsStorageValue = AssetsStorage[AssetsStorageKey];

/**
 * @public
 */
export type KeyValuePair<
  K extends AssetsStorageKey = AssetsStorageKey,
  V extends AssetsStorageValue = AssetsStorageValue,
> =
  | {
      key: K;
      value: V;
    }
  | {
      key: K;
      value?: V;
    }
  | {
      key?: K;
      value: V;
    };

/**
 * @public
 */
export type JsonStringifyReplacer =
  | ((this: any, key: string, value: any) => any)
  | (string | number)[]
  | null
  | undefined;

/**
 * @public
 */
export type JsonStringifySpace = Parameters<JSON['stringify']>[2];
