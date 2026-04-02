const baseConfig = require('../../enforce-coverage.config.base');
const path = require('path')

// core.ts is a wiring/bootstrap module (similar to background.ts in firefox-extension).
// It composes providers and wires them to the event bus — no standalone logic to unit test.
const config = {
  ...baseConfig,
  thresholds: {
    statements: 100,
    branches: 100,
    functions: 100,
    lines: 100,
  },
  extraExcludePatterns: [
    // Wiring module — composes providers and event bus, tested via integration
    'src/core.ts',
    // E2E action creators — exercised by extension E2E tests, not unit-testable
    'src/e2e-actions/**',
  ],
};

config.enforceCoverage({
  projectRoot: path.resolve(__dirname),
  thresholds: config.thresholds,
  showTextTable: true,
  extraExcludePatterns: config.extraExcludePatterns,
})
