#!/usr/bin/env node
const { execSync, spawn } = require('child_process')
const path = require('path')
const http = require('http')

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

function waitForServer(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    function attempt() {
      http.get(url, (res) => {
        res.resume()
        resolve()
      }).on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`Server at ${url} did not start within ${timeoutMs}ms`))
          return
        }
        setTimeout(attempt, 200)
      })
    }
    attempt()
  })
}

async function runE2ETests() {
  console.log('\n=== Hutch - Running E2E tests ===\n')
  process.stdout.write('')

  // Strip NODE_V8_COVERAGE for the e2e server and playwright using `env -u`.
  // Node.js 22 propagates V8 coverage to child processes regardless of the
  // `env` option in spawn/execSync, so we use the OS-level `env` command.
  // Without this, the server's partial runtime coverage corrupts jest's totals.
  // E2E action files are covered by the playwright worker processes instead.
  const serverProcess = spawn(
    'env', ['-u', 'NODE_V8_COVERAGE', 'node', 'dist/e2e/e2e-server.js'],
    { cwd: projectRoot, stdio: 'inherit' },
  )

  try {
    await waitForServer('http://localhost:3100')

    execSync(
      'node_modules/.bin/playwright test --config playwright.config.local-dev.ts',
      {
        cwd: projectRoot,
        stdio: 'inherit',
        env: { ...process.env, HEADLESS: 'true' },
      },
    )
  } finally {
    serverProcess.kill('SIGTERM')
  }

  process.stdout.write('')
}

async function main() {
  run('Hutch - Running unit tests',
    'node_modules/.bin/jest --testMatch="**/dist/**/*.test.js" --testTimeout=10000 --runInBand')

  run('Hutch - Running integration tests',
    'node_modules/.bin/jest --testMatch="**/dist/**/*.integration.js" --testTimeout=30000 --runInBand --passWithNoTests')

  await runE2ETests()

  console.log('\n=== Hutch - All tests completed successfully ===\n')
  // Ensure final output is flushed before exit
  process.stdout.write('')
}

main().catch((error) => {
  console.error('Test run failed:', error.message)
  process.exit(1)
})
