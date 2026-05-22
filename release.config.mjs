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
            release: 'patch',
          },
          // Use this one when we want to release a minor version for dependency updates.
          {
            type: 'chore',
            scope: 'deps-minor',
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
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        presetConfig: {
          types: [
            { type: 'feat', section: 'Features' },
            { type: 'fix', section: 'Bug Fixes' },
            { type: 'chore', scope: 'deps', section: 'Dependencies' },
            { type: 'chore', scope: 'deps-minor', section: 'Dependencies' },
            { type: 'docs', section: 'Documentation' },
            { type: 'refactor', section: 'Refactoring' },
            { type: 'chore', scope: 'spelling', section: 'Other' },
          ],
        },
      },
    ],
    [
      '@semantic-release/npm',
      {
        provenance: true,
      },
    ],
    '@semantic-release/github',
  ],
};
