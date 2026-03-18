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

### `c8 ignore` for Intermittent Retry Paths

Retry callbacks (e.g., `beforeRetry`) that only execute under CI flakiness (slow network, delayed parsing) will never fire during a passing local run. Use `/* c8 ignore next */` with a comment explaining why:

```typescript
// c8 ignore: beforeRetry only executes on CI when article parsing is slow
beforeRetry: /* c8 ignore next */ async (p) => { await p.reload({ waitUntil: 'domcontentloaded' }) },
```

This is the **only** approved use of c8 ignore in E2E code — for retry paths that are inherently non-deterministic.

## Running E2E Tests

E2E tests run as part of `pnpm check` which includes headless E2E execution with coverage.

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
