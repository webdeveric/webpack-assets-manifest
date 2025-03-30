/**
 * @type {import('@commitlint/types').UserConfig}
 */
export default {
  extends: ['@commitlint/config-conventional'],
  plugins: ['commitlint-plugin-cspell'],
  rules: {
    'cspell/type': [2, 'always'],
    'cspell/scope': [2, 'always'],
    'cspell/subject': [2, 'always'],
    'cspell/body': [2, 'always'],
    'cspell/footer': [2, 'always'],
    'scope-case': [2, 'always', ['lower-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
  },
};
