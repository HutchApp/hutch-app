/** @type {import('knip').KnipConfig} */
module.exports = {
  ignore: [
    // Client-side scripts loaded dynamically via readFileSync in tests
    '**/*.client.js',
    // Integration test files are entry points for jest
    '**/*.integration.ts',
    // Test utilities used by integration tests
    '**/test-utils.ts',
    // PurgeCSS config loaded via CLI, not imported in source
    'purgecss.config.js',
  ],
  ignoreDependencies: [
    // Used via CLI in dev script
    'livereload',
    // Used via c8 CLI wrapper in test-with-coverage script
    'c8',
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
