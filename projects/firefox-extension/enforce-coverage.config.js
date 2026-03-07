const baseConfig = require('../../enforce-coverage.config.base');
const path = require('path')

// Thresholds reflect current coverage.
// branches: 94.44% — V8 coverage quirk on instanceof ternary in
// in-memory-auth.ts whenLoggedIn error handling.
// statements/lines: 97.46% — in-memory-auth.ts catch block (lines 29-33)
// not exercised by current tests.
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
