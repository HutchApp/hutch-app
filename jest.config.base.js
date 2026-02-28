// Pre-compile approach: TypeScript is compiled before running tests
// This eliminates V8 coverage artifacts on type definitions
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  // No transform needed - TypeScript is pre-compiled
  transform: {},
  moduleFileExtensions: ['js', 'json'],
  rootDir: '.',
};
