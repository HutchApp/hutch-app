const baseConfig = require('../../enforce-coverage.config.base');
const path = require('path')

const config = {
  ...baseConfig,
  thresholds: {
    statements: 97,
    branches: 91,
    functions: 100,
    lines: 97,
  },
};

config.enforceCoverage({
  projectRoot: path.resolve(__dirname),
  thresholds: config.thresholds,
  extraExcludePatterns: [
    ...(config.extraExcludePatterns || []),
    'src/infra/**',
    // Composition roots — no logic to test, only wiring
    'src/runtime/app.ts',
    // E2E test infrastructure — coverage depends on V8 data from Playwright/E2E server process, which is non-deterministic
    'src/e2e/**',
    // DynamoDB adapters — thin AWS SDK wrappers tested via integration against real DynamoDB
    'src/runtime/providers/**/dynamodb-*.ts',
    // Resend adapter — thin SDK wrapper, same rationale as DynamoDB adapters
    'src/runtime/providers/email/resend-email.ts',
  ],
})
