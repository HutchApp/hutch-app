const baseConfig = require('../../enforce-coverage.config.base');
const path = require('path');

const config = {
  ...baseConfig,
  thresholds: {
    statements: 100,
    branches: 100,
    functions: 100,
    lines: 100,
  },
};

config.enforceCoverage({
  projectRoot: path.resolve(__dirname),
  thresholds: config.thresholds,
  showTextTable: true,
  extraExcludePatterns: [
    ...(config.extraExcludePatterns || []),
    // Infrastructure — Pulumi IaC and Lambda entry points
    'src/infra/**',
    // DynamoDB adapters — thin AWS SDK wrappers tested via integration against real DynamoDB
    'src/generate-summary/dynamodb-summary-cache.ts',
    'src/save-link/find-article-content.ts',
  ],
});
