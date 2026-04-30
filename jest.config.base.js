const path = require('node:path');

// Pre-compile approach: TypeScript is compiled before running tests
// This eliminates V8 coverage artifacts on type definitions
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  // No transform needed - TypeScript is pre-compiled
  transform: {},
  moduleFileExtensions: ['js', 'json'],
  rootDir: '.',
  // Suppress captured console.* output in CI to keep logs scannable; keep
  // verbose output locally so debug logs remain visible during dev.
  silent: process.env.CI === 'true',
  // jest.retryTimes lives in this setup file. Attaching here so every
  // project picks it up without each having to reference it explicitly.
  setupFilesAfterEnv: [path.resolve(__dirname, 'jest.setup.base.js')],
};
