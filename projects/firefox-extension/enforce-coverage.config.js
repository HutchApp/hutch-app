const baseConfig = require('../../enforce-coverage.config.base');
const path = require('path')

// Thresholds set below current coverage (99%+) to allow minor
// fluctuations without breaking CI when new code is added.
const config = {
  ...baseConfig,
  thresholds: {
    statements: 97,
    branches: 94,
    functions: 100,
    lines: 97,
  },
  extraExcludePatterns: [
    // esbuild entry points — bootstrap code for browser extension
    'src/runtime/background/background.ts',
    'src/runtime/background/background-dev.ts',
    'src/runtime/background/init-background.ts',
    'src/runtime/popup/popup.ts',
    'src/runtime/content/shortcut.ts',
  ],
};

config.enforceCoverage({
  projectRoot: path.resolve(__dirname),
  thresholds: config.thresholds,
  extraExcludePatterns: config.extraExcludePatterns,
})
