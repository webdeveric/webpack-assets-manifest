/**
 * @type {Partial<import('semantic-release').GlobalConfig>}
 */
export default {
  branches: ['master'],
  preset: 'conventionalcommits',
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        releaseRules: [
          {
            type: 'chore',
            scope: 'deps',
            release: 'minor',
          },
          {
            type: 'chore',
            scope: 'deps-dev',
            release: false,
          },
          {
            type: 'docs',
            release: 'patch',
          },
          {
            type: 'refactor',
            release: 'patch',
          },
          {
            type: 'chore',
            scope: 'spelling',
            release: 'patch',
          },
        ],
      },
    ],
    '@semantic-release/release-notes-generator',
    '@semantic-release/npm',
    '@semantic-release/github',
  ],
};
