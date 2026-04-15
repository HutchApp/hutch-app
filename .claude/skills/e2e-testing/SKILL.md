---
name: e2e-testing
description: E2E testing conventions using Playwright and the HATEOAS-based test framework. Use when working with E2E tests, files in e2e/ directories, *.e2e*.ts files, or when test errors mention Playwright, HATEOASClient, NavigationHandler, PageAction, or locator timeouts.
---

# E2E Testing Guidelines

Conventions for writing and debugging E2E tests using the project's HATEOAS-based Playwright test framework.

## Architecture

State machine-based test runner where tests provide data and the runner automatically discovers and executes available actions.

For implementation details, see `src/e2e/hateoas/` and any `*.e2e-local.ts` file in `src/e2e/`.

## Selector Strategy

- **NEVER hook visual labels to E2E tests** - query by `name` or `id` attributes instead
- Prefer `page.locator('input[name="fieldName"]')` over `page.getByLabel('Field Label')`
- Use `data-test-*` attributes only for elements without semantic attributes

## Identify Pages by Body Class, Not URL

Do not hook into URLs to detect page navigation. URLs are implementation details.

```typescript
// BAD - Hooks into URL structure
await page.waitForURL('**/passengers**');

// GOOD - Hooks into page identifier class
await page.waitForSelector('body.page-passengers');
```

## Action Availability Detection

**CRITICAL**: PageAction `isAvailable` functions MUST use element-based detection, NOT URL path checks.

Use `assert` (from `node:assert/strict`) inside `isAvailable` to verify element state. This ensures the check line is properly covered by test instrumentation. The surrounding `try/catch` converts assertion failures into `false` returns.

```typescript
// FORBIDDEN
isAvailable: async page => {
  if (page.url().includes('/flights')) return false
}

// REQUIRED - Element-based with assert
isAvailable: async page => {
  try {
    const element = page.locator('#unique-element-id')
    const count = await element.count()
    assert.ok(count > 0, 'element should exist')
    return true
  } catch {
    return false
  }
}
```

## Page Reload After Form Submissions

Form submissions and link clicks may cause full page reloads or HTMX AJAX swaps. Use `clickAndWaitForPageReload` which handles both:

```typescript
async function clickAndWaitForPageReload(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  const loadOrHtmxSwap = Promise.race([
    page.waitForEvent('load'),
    page.waitForResponse(resp => resp.request().headers()['hx-request'] === 'true'),
  ])
  await locator.click()
  await loadOrHtmxSwap
}
```

Without this, `waitForLoadState('domcontentloaded')` may resolve immediately before navigation starts.

## Prefer Self-Contained Test Data

Keep test data inline within each E2E test flow rather than extracting to shared fixtures.

## Coverage for E2E Test Support Code

E2E test support files (`src/e2e/**`) are **not excluded** from coverage enforcement. They run under c8 during `pnpm check` and must meet the same thresholds as production code.

For `c8 ignore` rules, allowed cases, and V8 coverage quirks, see the [Code Coverage section in CLAUDE.md](../../../CLAUDE.md#code-coverage).

## Running E2E Tests

E2E tests run as part of `pnpm check` which includes headless E2E execution with coverage.

## Never Reuse an Existing Server — Every Run Gets a Fresh One on a Fresh Port

Playwright's `reuseExistingServer: true` is forbidden. If a stale dev server or a previous test run is still bound to the same port, Playwright silently connects to it and runs the test against the wrong instance. The failures are indistinguishable from real regressions and the passes are worse — tests that pass against wrong state. Pair this with a dynamically allocated port per run so hardcoded ports can't collide with a running dev server.

```ts
// BAD — silently matches any server already on that port
webServer: {
  command: 'tsx src/e2e/e2e-server.main.ts',
  url: serverUrl,
  reuseExistingServer: true,
}

// BAD — hardcoded port collides with dev servers and previous runs
"test:e2e": "E2E_PORT=3100 playwright test --config playwright.config.local-dev.ts"
```

The projects in this repo use the `@packages/test-phase-runner` pattern: `scripts/run-e2e.js` allocates a free port via `getFreePort`, then `initTestPhaseRunner` launches the compiled server in a separate process (with `stripCoverage: true` to unset `NODE_V8_COVERAGE`) and only invokes Playwright once the server answers. The Playwright config sets `webServer: undefined` so Playwright never manages the server itself.

```ts
// playwright.config.local-dev.ts — Playwright does NOT manage the server
export default createPlaywrightConfig({
  baseURL: `http://localhost:${process.env.E2E_PORT || '0'}`,
  webServer: undefined,
  // ...
})

// scripts/run-e2e.js — allocate a free port, then run the playwright phase
const { initTestPhaseRunner, defaultDeps, getFreePort } = require('@packages/test-phase-runner')

async function main() {
  const port = await getFreePort()
  process.env.E2E_PORT = String(port)

  const { createTestPlan } = initTestPhaseRunner(defaultDeps)
  const plan = createTestPlan({
    config: {
      projectName: 'Readplace',
      phases: [{
        type: 'playwright',
        name: 'Running E2E tests',
        config: 'playwright.config.local-dev.ts',
        browsers: ['chromium'],
        server: {
          command: ['node', 'dist/e2e/e2e-server.main.js'],
          url: `http://localhost:${port}`,
          stripCoverage: true,
        },
        env: { HEADLESS: process.env.HEADLESS || 'false', E2E_PORT: String(port) },
      }],
    },
    projectRoot: join(__dirname, '..'),
  })
  await plan.runAllPhases()
}
```

The factory still forces `reuseExistingServer: false` as a safety net for any config that does pass a `webServer` (e.g. staging).

## Debugging E2E Test Failures

### Failure Types

| Type | Description |
|------|-------------|
| Locator Timeout | Element not found on page |
| Assertion Failure | Element exists but has wrong value |
| Action Availability | PageAction.isAvailable returns unexpected result |
| Flow Stuck | No available actions, flow incomplete |
| Max Navigations | Flow did not complete within maxNavigations limit |

### Debug Using Test Artifacts

- Screenshots on failure: `test-results/`
- Traces: Open with `npx playwright show-trace trace.zip`

### Common Fixes

| Symptom | Solution |
|---------|----------|
| Locator timeout for known element | Update selector to match current DOM |
| Flaky test (passes sometimes) | Wait for specific element state, not arbitrary timeout |
| Flow completes too early/never | Adjust successDetector logic |
| Strict mode violation on selector | Use `a:text-is("Read")` for exact match instead of `a:has-text("Read")` |
