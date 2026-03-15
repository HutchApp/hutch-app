---
name: test-driven-design
description: Software design and testing conventions that support testability. Use when writing tests, designing testable code, working with dependency injection, or when test coverage issues arise.
---

# Test Driven Design Guidelines

Conventions for writing tests and designing code that is easy to test.

## Design for Testability

### Dependency Injection Over Mocks

Prefer dependency injection over `jest.mock()`. Mocks couple tests to implementation details.

```typescript
// ❌ BAD - Couples test to module structure
jest.mock('./services/email-service');

// ✅ GOOD - Inject dependencies via factory function
export function createApp(deps: AppDependencies) { ... }
```

For real examples, see `projects/hutch/src/server.ts` which composes all dependencies at startup.

### Partial Application for Domain Functions

Domain functions with dependencies must use partial application. Use an `init*` prefix for the initialization function.

```typescript
// ❌ BAD - Dependencies mixed with execution parameters
export function createPaymentPlan(input: Input, deps: Deps) { ... }

// ✅ GOOD - Partial application separates concerns
export function initCreatePaymentPlan(deps: Deps): (input: Input) => PaymentPlan { ... }
```

For real examples, see `init*` functions in `projects/hutch/src/domain/` and `projects/hutch/src/providers/`.

### No Design Pattern Names in Identifiers

Do not name variables, functions, types, or files with design pattern suffixes like `Service`, `Factory`, `Singleton`, etc.

```typescript
// ❌ BAD
interface EncryptedLinkService { ... }

// ✅ GOOD - Domain-focused name
interface EncryptedLink { ... }
```

### Make Invalid States Non-Representable

Use TypeScript's type system to prevent invalid states at compile time.

```typescript
type SupportedLocale = 'en-AU';
```

### No Silent Fallbacks for Missing Values

Do not use conditionals to provide empty defaults when a dependency may be null. This allows the system to continue in an invalid state.

```typescript
// ❌ BAD - Silent fallback hides missing config
const targets = toCustomerEmail ? [toCustomerEmail] : [];

// ✅ GOOD - Fail fast if required
const resendApiKey = requireEnv("RESEND_API_KEY");
```

### No Default In-Memory Implementations

Never default a dependency to an in-memory implementation in production code. All dependencies MUST be mandatory and the in-memory or production implementations are explicitly set at the entry point (composition root). In-memory implementations are for tests only.

```typescript
// ❌ BAD - Silent fallback to in-memory
function createWidget(deps: { store?: Store }) {
	const store = deps.store ?? initInMemoryStore();
}

// ✅ GOOD - Store is required
function createWidget(deps: { store: Store }) {
	const store = deps.store;
}
```

### Named Parameters Over Positional When Types Repeat

When a function signature has 2 or more consecutive parameters of the same type (e.g., `(string, string)` or `(number, number)`), use a named parameter object instead. Positional arguments of the same type are easy to swap by accident (connascence of position is weaker than connascence of name).

```typescript
// ❌ BAD - Two consecutive strings are easy to swap
type Login = (email: string, password: string) => Promise<LoginResult>;
await auth.login("user@example.com", "password123");

// ✅ GOOD - Named parameters prevent accidental swaps
type Login = (credentials: { email: string; password: string }) => Promise<LoginResult>;
await auth.login({ email: "user@example.com", password: "password123" });
```

This does NOT apply when the types differ (e.g., `(string, number)`) or when there is only one parameter.

### No Unnecessary Runtime Validation

If TypeScript already enforces a constraint at compile time, do not add runtime validation for the same constraint.

### No Defensive Checks Without Valid Tests

Every code path must be exercised by tests. Do not add `|| ''` or `?? defaultValue` unless there is a test for the fallback.

## Writing Tests

### Selector Strategy

- Hook into CSS classes for querying elements, not visual text
- Use `data-test-*` attributes for test metadata
- Avoid coupling to labels/view text

For example patterns, see tests in `projects/hutch/src/web/pages/`.

### Test Behavior, Not Element Existence

Do not write assertions that only check if an element exists.

```typescript
// ❌ BAD - Only checks element exists
expect(input).not.toBeNull();

// ✅ GOOD - Tests behavior
input.value = 'John';
expect(input.value).toBe('John');
```

### Avoid Negative Test Assertions

Negative assertions (`.not.toContain()`) become stale when code is refactored.

```typescript
// ❌ BAD - Becomes stale if format changes
expect(subtitleText).not.toContain('–');

// ✅ GOOD - Test the actual expected value
expect(subtitleText).toBe('SYD to MEL');
```

### Prefer Self-Contained Test Data

Keep test data inline within each test case rather than extracting to shared fixtures.

### External API Integration Tests Must Use Retry Logic

When testing external APIs (e.g., Amadeus flight search), use the `Retriable` class from `test-utils` to implement retry logic. Do NOT switch to static/mock providers to mask real API behavior.

For usage examples, see `projects/hutch/src/test-utils.ts`.

### Never Test Code That Is Only Used in Tests

Do not create unit tests for functions, types, or schemas that are only used by other tests. If a function is exported but never imported by production code, delete it.

### Meaningful Variable Names Over Technical Prefixes

```typescript
// ❌ BAD - Technical prefix without meaning
const mockSearchParams = { ... };

// ✅ GOOD - Describes what the data represents
const sydneyToMelbourneParams = { ... };
```

## Code Coverage

### Coverage Over Legibility

100% code coverage is more important than code legibility. When V8 coverage instrumentation requires restructuring code, make those changes with explanatory comments linking to verified online resources.

### No Coverage Ignore Comments

Coverage ignore comments (`/* c8 ignore */`) are forbidden unless explicitly approved. Instead, restructure code to eliminate untestable branches.

```typescript
// ❌ BAD - hiding untested code
/* c8 ignore start */
if (value === null) { return defaultValue }
/* c8 ignore stop */

// ✅ GOOD - assertion fails fast
assert(value !== null, 'Value must not be null')
```
