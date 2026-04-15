import { createPlaywrightConfig } from './playwright.config.factory'

const serverUrl = `http://localhost:${process.env.E2E_PORT || '0'}`

// `env -u NODE_V8_COVERAGE` strips the env var c8 sets during coverage runs so the e2e
// server's own execution doesn't write coverage data into the jest coverage dir and
// contaminate the summary. See .claude/skills/e2e-testing/SKILL.md.
export default createPlaywrightConfig({
  testMatch: '**/*.e2e-local.ts',
  outputDir: './test-results',
  baseURL: serverUrl,
  retries: 0,
  headless: process.env.HEADLESS === 'true',
  webServer: {
    command: 'env -u NODE_V8_COVERAGE node dist/e2e/e2e-server.main.js',
    // Routes are mounted at /embed; the bare root 404s, so point readiness at the
    // health endpoint under the /embed prefix.
    url: `${serverUrl}/embed/health`,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
