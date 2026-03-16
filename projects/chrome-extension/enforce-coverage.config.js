const baseConfig = require('../../enforce-coverage.config.base');
const path = require('path')

const config = {
  ...baseConfig,
  thresholds: {
    statements: 100,
    branches: 100,
    functions: 100,
    lines: 100,
  },
  extraExcludePatterns: [
    // esbuild entry points — bootstrap code for browser extension
    'src/runtime/background/background.ts',
    'src/runtime/popup/popup.ts',
    'src/runtime/content/shortcut.ts',
    // E2E tests run with Playwright, not covered by c8
    'src/e2e/**',
  ],
};

config.enforceCoverage({
  projectRoot: path.resolve(__dirname),
  thresholds: config.thresholds,
  extraExcludePatterns: config.extraExcludePatterns,
})
