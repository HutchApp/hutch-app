const baseConfig = require('../../enforce-coverage.config.base');
const path = require('path')

const config = {
  ...baseConfig,
  thresholds: {
    statements: 99,
    branches: 97,
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

    'src/infra/**',
    // Composition roots — no logic to test, only wiring
    'src/runtime/app.ts',
    'src/e2e/e2e-server.ts',
    // DynamoDB adapters — thin AWS SDK wrappers tested via integration against real DynamoDB
    'src/runtime/providers/**/dynamodb-*.ts',
    // Resend adapter — thin SDK wrapper, same rationale as DynamoDB adapters
    'src/runtime/providers/email/resend-email.ts',
    // EventBridge adapter — thin wiring to publish events, only used in prod path
    'src/runtime/providers/events/eventbridge-link-saved.ts',
    // Staging E2E tests — only run in CI against deployed staging, not locally
    '**/*.e2e-staging.ts',
  ],
})
