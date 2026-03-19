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
        command: ['node', 'dist/e2e/e2e-server.js'],
        url: 'http://localhost:3100',
        stripCoverage: true,
      },
      env: { HEADLESS: 'true' },
    },
  ],
};
