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
      type: 'node-test',
      name: 'Running integration tests',
      glob: 'dist/**/*.integration.js',
    },
  ],
};
