import { defineConfig, devices } from '@playwright/test'

interface PlaywrightConfigOptions {
  testMatch: string
  outputDir: string
  baseURL: string | undefined
  retries: number
  headless: boolean
  webServer:
    | {
        command: string
        url: string
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
    timeout: 60000,
    expect: {
      toHaveScreenshot: {
        // Cross-platform font rendering (mac vs linux) and antialiasing differences mean the
        // same rendered element can differ by ~2-4% of pixels without being a real regression.
        // Baselines are captured on one device and compared against all; this slack covers
        // text edge anti-aliasing so we don't need per-platform baselines.
        maxDiffPixelRatio: 0.05,
        threshold: 0.2,
        animations: 'disabled',
        caret: 'hide',
      },
    },
    use: {
      baseURL: options.baseURL,
      trace: 'on-first-retry',
      headless: options.headless,
      screenshot: 'only-on-failure',
      video: 'off',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
    // Never reuse an existing server — a stale dev server or previous test run on the same port
    // will silently match and the test will run against the wrong instance. See .claude/skills/e2e-testing/SKILL.md.
    webServer: options.webServer
      ? { ...options.webServer, reuseExistingServer: false }
      : undefined,
  })
}
