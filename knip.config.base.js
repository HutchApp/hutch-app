/** @type {import('knip').KnipConfig} */
module.exports = {
  ignore: [
    // Client-side scripts loaded dynamically via readFileSync in tests
    '**/*.client.js',
    // Integration test files are entry points for jest
    '**/*.integration.ts',
    // Test utilities used by integration tests
    '**/test-utils.ts',
  ],
  ignoreDependencies: [
    // Used via CLI in dev script
    'livereload',
  ],
  ignoreBinaries: [
    // Installed at root level in monorepo
    'knip',
    'biome',
  ],
};
