const baseConfig = require('../../enforce-coverage.config.base');
const path = require('path')

// Thresholds reflect current coverage.
// branches: 89% — V8 coverage quirks on ternary/conditional expressions,
// OAuth middleware integration paths, and some queue page branches.
// functions: 96% — OAuth routes use @node-oauth/express-oauth-server middleware
// handlers that are hard to test without mocking the entire OAuth flow.
const config = {
  ...baseConfig,
  thresholds: {
    statements: 98,
    branches: 89,
    functions: 96,
    lines: 98,
  },
};

config.enforceCoverage({
  projectRoot: path.resolve(__dirname),
  thresholds: config.thresholds,
  extraExcludePatterns: [
    ...(config.extraExcludePatterns || []),
    'src/infra/**',
    // Composition and server start entry point — no logic to test
    'src/runtime/app.ts',
    // DynamoDB adapters — thin AWS SDK wrappers tested via integration against real DynamoDB
    'src/runtime/providers/**/dynamodb-*.ts',
    // OAuth routes — thin wrapper around @node-oauth/express-oauth-server middleware
    'src/runtime/web/oauth/oauth.routes.ts',
  ],
})
