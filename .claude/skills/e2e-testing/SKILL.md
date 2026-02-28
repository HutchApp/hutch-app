---
name: e2e-testing
description: E2E testing conventions using Playwright and the flow-based test framework. Use when working with E2E tests, files in e2e/ directories, *.e2e*.ts files, or when test errors mention Playwright, FlowRunner, FlowAction, or locator timeouts.
---

# E2E Testing Guidelines

Conventions for writing and debugging E2E tests using the project's flow-based Playwright test framework.

## Architecture

State machine-based test runner where tests provide data and the runner automatically discovers and executes available actions.

For implementation details, see:
- [projects/hutch/src/e2e/test-framework/flow-runner.ts](projects/hutch/src/e2e/test-framework/flow-runner.ts) - Main orchestrator
- [projects/hutch/src/e2e/test-framework/flow-state-handler.types.ts](projects/hutch/src/e2e/test-framework/flow-state-handler.types.ts) - Interface definitions

For usage examples, see any `*.e2e-local.ts` file in `projects/hutch/src/e2e/`.

## Selector Strategy

- **NEVER hook visual labels to E2E tests** - query by `name` or `id` attributes instead
- Prefer `page.locator('input[name="fieldName"]')` over `page.getByLabel('Field Label')`
- Use `data-test-*` attributes only for elements without semantic attributes

## Identify Pages by Body Class, Not URL

Do not hook into URLs to detect page navigation. URLs are implementation details.

```typescript
// ❌ BAD - Hooks into URL structure
await page.waitForURL('**/passengers**');

// ✅ GOOD - Hooks into page identifier class
await page.waitForSelector('body.page-passengers');
```

## Action Availability Detection

**CRITICAL**: FlowAction `isAvailable` functions MUST use element-based detection, NOT URL path checks.

```typescript
// ❌ FORBIDDEN
isAvailable: async page => {
  if (page.url().includes('/flights')) return false
}

// ✅ REQUIRED - Element-based
isAvailable: async page => {
  const element = page.locator('#unique-element-id')
  const exists = await element.count() > 0
  if (!exists) return false
  // Additional value checks...
}
```

For real examples, see action files in `projects/hutch/src/e2e/return-flow/`.

## Retry Strategy for External APIs

E2E tests that depend on external APIs may encounter empty results. Use the `Retriable` class from the test framework.

For usage examples, see:
- [projects/hutch/src/e2e/test-framework/retriable.ts](projects/hutch/src/e2e/test-framework/retriable.ts) - Class definition
- [projects/hutch/src/e2e/return-flow/run.e2e-local.ts](projects/hutch/src/e2e/return-flow/run.e2e-local.ts) - Usage in tests

## Prefer Self-Contained Test Data

Keep test data inline within each E2E test flow rather than extracting to shared fixtures.

## E2E Test Infrastructure Is Production Code

The e2e test infrastructure (`*.e2e-local.ts`, framework code, action handlers) is production code covered by c8 coverage checks. Do NOT add e2e directories to `.c8rc.json` exclusions.

## Running E2E Tests

Inspect `projects/hutch/project.json` for available test targets and their configurations.

## Debugging E2E Test Failures

### Failure Types

| Type | Description |
|------|-------------|
| Locator Timeout | Element not found on page |
| Assertion Failure | Element exists but has wrong value |
| Action Availability | FlowAction.isAvailable returns unexpected result |
| Flow Stuck | No available actions, flow incomplete |
| Retriable Exhausted | All retry attempts failed |

### Debug Using Test Artifacts

- Screenshots on failure: `test-results/`
- Traces: Open with `npx playwright show-trace trace.zip`

### Common Fixes

| Symptom | Solution |
|---------|----------|
| Locator timeout for known element | Update selector to match current DOM |
| Flaky test (passes sometimes) | Wait for specific element state, not arbitrary timeout |
| Flow completes too early/never | Adjust successDetector logic |
| All retry attempts exhausted | Adjust retry parameters or data mutation strategy |

## Action File Naming Conventions

Action files that interact with external payment providers must follow the pattern `*-<provider>-actions.ts` (e.g., `checkout-stripe-actions.ts`). This enables glob-based coverage exclusions when running with static providers.

```
checkout-stripe-actions.ts    ✅ GOOD - Matches **/*-stripe-actions.ts
stripe-checkout-actions.ts    ❌ BAD  - Does not match glob pattern
```

## Visual Regression Testing

Visual regression testing captures screenshots after each action and compares against committed baselines in `visual-baselines/`.

For implementation, see:
- [projects/hutch/src/e2e/test-framework/](projects/hutch/src/e2e/test-framework/) - Screenshot capture and comparison utilities

### Updating Baselines

```bash
VISUAL_BASELINE_UPDATE=true pnpm nx run flights:test-ui
```

### Debugging Failures

1. Download `visual-regression-diffs` artifact from GitHub Actions
2. Compare diff images with baselines in `visual-baselines/`
3. Either update baselines (intentional change) or fix the regression

| Option | Description | Default |
|--------|-------------|---------|
| `threshold` | Pixel comparison sensitivity (0-1) | 0.1 |
| `tolerancePercent` | Acceptable diff percentage (0-100) | 0.1 |
