const baseConfig = require('../../enforce-coverage.config.base');
const path = require('path')

// All testable code moved to extension-core.
// Remaining files are shell wiring (entry points, browser-specific adapters).
const config = {
  ...baseConfig,
  thresholds: {
    statements: 100,
    branches: 100,
    functions: 100,
    lines: 100,
  },
  extraExcludePatterns: [
    // esbuild entry points — shell wiring for browser extension
    'src/runtime/background/background.ts',
    'src/runtime/popup/popup.ts',
    'src/runtime/content/shortcut.ts',
  ],
};

config.enforceCoverage({
  projectRoot: path.resolve(__dirname),
  thresholds: config.thresholds,
  extraExcludePatterns: config.extraExcludePatterns,
})
