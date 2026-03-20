import { defineConfig, devices } from '@playwright/test'

interface PlaywrightConfigOptions {
  testMatch: string
  outputDir: string
  baseURL: string | undefined
  retries: number
  headless: boolean
  timeout?: number
  video: 'off' | 'on' | 'retain-on-failure' | 'on-first-retry'
  launchOptions: { slowMo?: number } | undefined
  webServer:
    | {
        command: string
        url: string
        reuseExistingServer: boolean
        stdout: 'pipe' | 'ignore'
        stderr: 'pipe' | 'ignore'
      }
    | undefined
}

export const createPlaywrightConfig = (options: PlaywrightConfigOptions) => {
  return defineConfig({
    testDir: './src/e2e',
    testMatch: options.testMatch,
    outputDir: options.outputDir,
    fullyParallel: true,
    forbidOnly: true,
    reporter: 'html',
    retries: options.retries,
    timeout: options.timeout ?? 120000,
    use: {
      baseURL: options.baseURL,
      trace: 'on-first-retry',
      headless: options.headless,
      screenshot: 'only-on-failure',
      video: options.video,
    },
    projects: [
      {
        name: 'chromium',
        use: {
          ...devices['Desktop Chrome'],
          launchOptions: options.launchOptions,
        },
      },
    ],
    webServer: options.webServer,
  })
}
