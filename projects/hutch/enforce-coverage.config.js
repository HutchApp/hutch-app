const baseConfig = require('../../enforce-coverage.config.base');
const path = require('path')

const config = {
  ...baseConfig,
  thresholds: {
    statements: 99.6,
    branches: 97,
    functions: 100,
    lines: 99.6,
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
    'src/runtime/test-app.ts',
    // E2E test infrastructure — covered by E2E tests, not unit tests
    'src/e2e/**',
    // DynamoDB adapters — thin AWS SDK wrappers tested via integration against real DynamoDB
    'src/runtime/providers/**/dynamodb-*.ts',
    // Resend adapter — thin SDK wrapper, same rationale as DynamoDB adapters
    'src/runtime/providers/email/resend-email.ts',
  ],
})
