import { relative } from 'node:path';
import { cwd } from 'node:process';

/**
 * @type {(filenames: string[]) => string[]>}
 */
const relativeFilenames = (filenames) => {
  const root = cwd();

  return filenames.map((file) => relative(root, file));
};

/**
 * @type {Record<string, string | (filenames: string[]) => string | string[] | Promise<string | string[]>}
 */
export default {
  '*.{js,cjs,mjs,ts,cts,mts}': ['eslint --fix', 'prettier --write'],
  '*.{json,md}': 'prettier --write',
  '*': (filenames) => {
    const files = relativeFilenames(filenames);

    return [
      `cspell lint --no-progress --no-summary --no-must-find-files ${files.join(' ')}`,
      `sh -c 'echo "${files.join('\n')}" | cspell --show-context stdin'`, // Spell check file names.
    ];
  },
};
