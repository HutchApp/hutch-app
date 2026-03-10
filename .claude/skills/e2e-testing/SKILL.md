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

```typescript
// FORBIDDEN
isAvailable: async page => {
  if (page.url().includes('/flights')) return false
}

// REQUIRED - Element-based
isAvailable: async page => {
  const element = page.locator('#unique-element-id')
  const exists = await element.count() > 0
  if (!exists) return false
  // Additional value checks...
}
```

## Page Reload After Form Submissions

Form submissions in SSR apps cause full page reloads. Use `clickAndWaitForPageReload` to set up a load event listener before clicking:

```typescript
async function clickAndWaitForPageReload(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  const loadPromise = page.waitForEvent('load')
  await locator.click()
  await loadPromise
}
```

Without this, `waitForLoadState('domcontentloaded')` may resolve immediately before navigation starts.

## Prefer Self-Contained Test Data

Keep test data inline within each E2E test flow rather than extracting to shared fixtures.

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
