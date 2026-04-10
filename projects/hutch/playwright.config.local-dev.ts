import { createPlaywrightConfig } from './playwright.config.factory'

// Fallback to port 0 because knip loads this file during lint when E2E_PORT is not set
const serverUrl = `http://localhost:${process.env.E2E_PORT || '0'}`

export default createPlaywrightConfig({
  testMatch: '**/*.e2e-local.ts',
  outputDir: './test-results',
  baseURL: serverUrl,
  retries: 0,
  headless: process.env.HEADLESS === 'true',
  video: 'off',
  launchOptions: {},
  webServer: {
    command: 'tsx src/e2e/e2e-server.main.ts',
    url: serverUrl,
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
