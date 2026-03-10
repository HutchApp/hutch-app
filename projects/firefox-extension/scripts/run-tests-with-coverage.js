#!/usr/bin/env node
const { execSync } = require('child_process')
const { globSync } = require('node:fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')

function run(name, command, extraEnv = {}) {
  console.log(`\n=== ${name} ===\n`)
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
  process.stdout.write('')
}

run('Firefox Extension - Running unit tests',
  'node_modules/.bin/jest --testMatch="**/dist/**/*.test.js" --testPathIgnorePatterns="dist/e2e" --testTimeout=10000 --runInBand --passWithNoTests')

const e2eUnitTests = globSync('dist/e2e/**/*.test.js').join(' ')

if (e2eUnitTests) {
  run('Firefox Extension - Running E2E unit tests', `node --test ${e2eUnitTests}`)
}

run('Firefox Extension - Running E2E tests',
  'node --test dist/e2e/login-flow/run.e2e-local.js',
  { HEADLESS: 'true' })

console.log('\n=== Firefox Extension - All tests completed successfully ===\n')
process.stdout.write('')
