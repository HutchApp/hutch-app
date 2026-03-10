#!/usr/bin/env node
const { execSync } = require('child_process')
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

run('Browser Extension Core - Running unit tests',
  'node_modules/.bin/jest --testMatch="**/dist/**/*.test.js" --testTimeout=10000 --runInBand')

console.log('\n=== Browser Extension Core - All tests completed successfully ===\n')
process.stdout.write('')
