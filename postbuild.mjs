#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('./dist/cjs', { recursive: true });

mkdirSync('./dist/mjs', { recursive: true });

writeFileSync(
  './dist/cjs/package.json',
  JSON.stringify({
    type: 'commonjs',
  }),
  'utf8',
);

writeFileSync(
  './dist/mjs/package.json',
  JSON.stringify({
    type: 'module',
  }),
  'utf8',
);
