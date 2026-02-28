const baseConfig = require('../../enforce-coverage.config.base');

// Thresholds reflect current coverage.
// branches: 91.67% — V8 coverage quirks on ternary/conditional expressions
// and some queue page branches not yet exercised by tests.
// statements/lines: 98.86% — queue.page.ts and queue.viewmodel.ts have
// uncovered lines for edge cases not yet tested.
module.exports = {
  ...baseConfig,
  thresholds: {
    statements: 98,
    branches: 91,
    functions: 100,
    lines: 98,
  },
};
