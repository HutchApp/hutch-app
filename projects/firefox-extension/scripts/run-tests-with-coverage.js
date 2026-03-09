#!/usr/bin/env node
const { execSync } = require('child_process')
const { globSync } = require('node:fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')

function run(name, command, extraEnv = {}) {
  console.log(`\n=== ${name} ===\n`)
  // Flush stdout before running command
  process.stdout.write('')
  try {
    execSync(command, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, ...extraEnv },
    })
  } catch (error) {
    console.error(`${name} failed with exit code ${error.status}`)
    process.exit(error.status || 1)
  }
  // Flush stdout after command completes
  process.stdout.write('')
}

run('Running unit tests',
  'node_modules/.bin/jest --testMatch="**/dist/**/*.test.js" --testPathIgnorePatterns="dist/e2e" --testTimeout=10000 --runInBand --passWithNoTests')

const e2eFiles = [
  ...globSync('dist/e2e/**/*.test.js'),
  ...globSync('dist/e2e/**/*.e2e-local.js'),
].join(' ')

run('Running E2E tests', `node --test ${e2eFiles}`)

console.log('\n=== All tests completed successfully ===\n')
// Ensure final output is flushed before exit
process.stdout.write('')
