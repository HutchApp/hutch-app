const assert = require('node:assert');
assert(process.env.E2E_PORT, 'E2E_PORT is required');
const port = process.env.E2E_PORT;

module.exports = {
  projectName: 'Hutch',
  phases: [
    {
      type: 'jest',
      name: 'Running unit tests',
      testMatch: '**/dist/**/*.test.js',
      timeout: 10000,
    },
    {
      type: 'jest',
      name: 'Running integration tests',
      testMatch: '**/dist/**/*.integration.js',
      timeout: 30000,
      passWithNoTests: true,
    },
    {
      type: 'playwright',
      name: 'Running E2E tests',
      config: 'playwright.config.local-dev.ts',
      browsers: ['chromium'],
      server: {
        command: ['node', 'dist/e2e/e2e-server.main.js'],
        url: `http://localhost:${port}`,
        stripCoverage: true,
      },
      env: { HEADLESS: 'true', E2E_PORT: port },
    },
  ],
};
