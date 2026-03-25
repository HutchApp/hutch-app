const baseConfig = require('../../../enforce-coverage.config.base');
const path = require('path')

// All testable business logic moved to browser-extension-core.
// Chrome-extension only contains browser-specific bootstrap code
// (entry points excluded below) and *.browser.ts files (excluded by base config).
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
    'src/runtime/offscreen/offscreen.ts',
    // E2E tests run with selenium, not covered by c8
    'src/e2e/**',
  ],
};

config.enforceCoverage({
  projectRoot: path.resolve(__dirname),
  thresholds: config.thresholds,
  extraExcludePatterns: config.extraExcludePatterns,
})
