#!/usr/bin/env node
const { execSync } = require('child_process')
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
  'node_modules/.bin/jest --testMatch="**/dist/**/*.test.js" --testTimeout=10000 --runInBand')

run('Running integration tests',
  'node_modules/.bin/jest --testMatch="**/dist/**/*.integration.js" --testTimeout=30000 --runInBand --passWithNoTests')

console.log('\n=== All tests completed successfully ===\n')
// Ensure final output is flushed before exit
process.stdout.write('')
