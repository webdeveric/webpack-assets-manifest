import { getHashes } from 'node:crypto';

import type { Schema } from 'schema-utils';

export const optionsSchema = {
  title: 'Webpack Assets Manifest options schema',
  description: 'Webpack Assets Manifest options',
  type: 'object',
  additionalProperties: false,
  properties: {
    enabled: {
      type: 'boolean',
      default: true,
    },
    assets: {
      type: 'object',
      default: {},
    },
    output: {
      type: 'string',
      default: 'assets-manifest.json',
    },
    replacer: {
      default: null,
      oneOf: [
        {
          $ref: '#/definitions/functionOrNull',
        },
        {
          type: 'array',
        },
      ],
    },
    space: {
      oneOf: [
        {
          type: 'integer',
          multipleOf: 1.0,
          minimum: 0,
        },
        {
          type: 'string',
          minLength: 1,
        },
      ],
      default: 2,
    },
    writeToDisk: {
      oneOf: [
        {
          type: 'boolean',
        },
        {
          const: 'auto',
        },
      ],
      default: 'auto',
    },
    fileExtRegex: {
      oneOf: [
        {
          instanceof: 'RegExp',
        },
        {
          type: 'null',
        },
        {
          const: false,
        },
      ],
    },
    sortManifest: {
      default: true,
      oneOf: [
        {
          type: 'boolean',
        },
        {
          instanceof: 'Function',
        },
      ],
    },
    merge: {
      default: false,
      oneOf: [
        {
          type: 'boolean',
        },
        {
          const: 'customize',
        },
      ],
    },
    publicPath: {
      default: null,
      oneOf: [
        {
          type: 'string',
        },
        {
          type: 'boolean',
        },
        {
          type: 'null',
        },
        {
          instanceof: 'Function',
        },
      ],
    },
    contextRelativeKeys: {
      type: 'boolean',
      default: false,
    },
    apply: {
      $ref: '#/definitions/functionOrNull',
    },
    customize: {
      $ref: '#/definitions/functionOrNull',
    },
    transform: {
      $ref: '#/definitions/functionOrNull',
    },
    done: {
      $ref: '#/definitions/functionOrNull',
    },
    entrypoints: {
      type: 'boolean',
      default: false,
    },
    entrypointsKey: {
      default: 'entrypoints',
      oneOf: [
        {
          type: 'string',
        },
        {
          const: false,
        },
      ],
    },
    entrypointsUseAssets: {
      type: 'boolean',
      default: false,
    },
    integrity: {
      type: 'boolean',
      default: 'a',
    },
    integrityHashes: {
      type: 'array',
      items: {
        type: 'string',
        enum: getHashes(),
      },
      default: ['sha256', 'sha384', 'sha512'],
    },
    integrityPropertyName: {
      description: 'The `asset.info` property name where the SRI hash is stored',
      type: 'string',
      minLength: 1,
      default: 'integrity',
    },
    extra: {
      description: 'A place to put your arbitrary data',
      type: 'object',
      default: {},
    },
  },
  definitions: {
    functionOrNull: {
      default: null,
      oneOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'null',
        },
      ],
    },
  },
} satisfies Schema;
