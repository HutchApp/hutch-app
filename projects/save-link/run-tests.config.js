module.exports = {
  projectName: 'Save Link',
  phases: [
    {
      type: 'jest',
      name: 'Running unit tests',
      testMatch: '**/dist/**/*.test.js',
      timeout: 10000,
    },
    {
      // e2e flag — integration tests in this project hit real AWS (DynamoDB,
      // S3) via createDynamoDocumentClient() and require AWS credentials sourced
      // from .envrc. Skipping under CLAUDE_CODE_REMOTE=true keeps `pnpm check`
      // credential-free on sandboxed CI and Claude Code sessions. See the
      // test-driven-design skill for the wrapper-tested-via-fake-client
      // convention that replaces these for the cases checked in today.
      type: 'node-test',
      name: 'Running integration tests',
      glob: 'dist/**/*.integration.js',
      e2e: true,
    },
  ],
};
