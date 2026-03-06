const baseConfig = require('../../enforce-coverage.config.base');
const path = require('path')

// branches: 92.98% — V8 coverage quirk on instanceof ternary in
// in-memory-auth.ts whenLoggedIn error handling, and conditional
// branches in popup-flow.ts loadAllItems error path.
const config = {
  ...baseConfig,
  thresholds: {
    statements: 97,
    branches: 92,
    functions: 100,
    lines: 97,
  },
};

config.enforceCoverage({
  projectRoot: path.resolve(__dirname),
  thresholds: config.thresholds,
})
