import { createPlaywrightConfig } from './playwright.config.factory'

export default createPlaywrightConfig({
  testMatch: '**/*.e2e-local.ts',
  outputDir: './test-results',
  baseURL: 'http://localhost:3100',
  retries: 0,
  headless: process.env.HEADLESS === 'true',
  video: 'off',
  launchOptions: {},
  webServer: {
    command: 'tsx src/e2e/e2e-server.ts',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
