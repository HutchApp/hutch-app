const localE2ePhases = process.env.CI ? [] : [
  {
    type: 'script',
    name: 'Building extension for E2E tests',
    command: 'node scripts/build-extension.js',
    env: { HUTCH_SERVER_URL: 'http://127.0.0.1:3000' },
  },
  {
    type: 'node-test',
    name: 'Running E2E tests',
    files: ['dist/e2e/login-flow/run.e2e-local.js'],
    env: { HEADLESS: 'true' },
  },
];

module.exports = {
  projectName: 'Firefox Extension',
  phases: [
    {
      type: 'jest',
      name: 'Running unit tests',
      testMatch: '**/dist/**/*.test.js',
      testPathIgnorePatterns: 'dist/e2e',
      timeout: 10000,
      passWithNoTests: true,
    },
    {
      type: 'node-test',
      name: 'Running E2E unit tests',
      glob: 'dist/e2e/**/*.test.js',
    },
    ...localE2ePhases,
  ],
};
