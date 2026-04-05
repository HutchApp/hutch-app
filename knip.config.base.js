/** @type {import('knip').KnipConfig} */
module.exports = {
  ignore: [
    // Integration test files are entry points for jest
    '**/*.integration.ts',
  ],
  ignoreDependencies: [
    // Type-only import — knip doesn't trace type imports as usage
    '@packages/hutch-logger',
    // Used via scripts/run-tests-with-coverage.js (not a source import)
    '@packages/test-phase-runner',
  ],
  ignoreBinaries: [
    // Installed at root level in monorepo
    'knip',
    'biome',
    // Used via check script to delegate to Nx
    'nx',
  ],
  ignoreExportsUsedInFile: true,
  workspaces: {
    // Pattern to match all workspaces in projects/
    'projects/*': {
      // Client-side scripts loaded via HTML script tags
      entry: ['**/*.client.js'],
    },
  },
};
