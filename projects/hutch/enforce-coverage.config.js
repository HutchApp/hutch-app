const baseConfig = require('../../enforce-coverage.config.base');
const path = require('path')

const config = {
  ...baseConfig,
  thresholds: {
    statements: 99,
    branches: 95,
    functions: 100,
    lines: 99,
  },
};

config.enforceCoverage({
  projectRoot: path.resolve(__dirname),
  thresholds: config.thresholds,
  showTextTable: true,
  extraExcludePatterns: [
    ...(config.extraExcludePatterns || []),
    // Infrastructure layer — deployed via Pulumi, not testable in CI
    'src/infra/**',
    // Gmail API adapter — thin fetch wrapper around Gmail REST API
    'src/runtime/providers/gmail/gmail-api.ts',
    // Gmail import orchestrator — integrates external Gmail API calls
    'src/runtime/providers/gmail/gmail-import.ts',
    // Token refresh coordinator — thin wrapper over find/refresh/save
    'src/runtime/providers/gmail/ensure-valid-access-token.ts',
  ],
})
