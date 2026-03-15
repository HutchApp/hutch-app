# Development Guidelines

## Setup

1. Install devbox: https://www.jetify.com/docs/devbox/installing-devbox#linux
  a) if unable to install devbox, check [devbox.json](./devbox.json) for required tools and install them manually (Node.js, AWS CLI, Pulumi, etc.), Check [.envrc](./.envrc) for required environment variables and set them in your shell profile (e.g., .bashrc, .zshrc)
1. Run pnpm install to install dependencies

## Architecture Guidelines

### Web Adapter Conventions

For HTML/CSS/SSR conventions, see the [web skill](./.claude/skills/web/SKILL.md).

### Test Driven Design

For testing conventions and designing testable code, see the [test-driven-design skill](./.claude/skills/test-driven-design/SKILL.md).

### Filter and Query Testing Strategy

Use integration tests for comprehensive filter/query functionality testing, not E2E tests. Filter logic tests should verify URL parameters produce correct HTML output using supertest + parseHTML.

| Test concern | Test type | Location |
|-------------|-----------|----------|
| Domain Logic | Unit test | `*.test.ts` next to implementation |
| Web Layer | Integration test | `*.route.test.ts` |


E2E tests have ~11s startup overhead per test (browser, server, navigation). Integration tests avoid this overhead while still testing the full server-side flow.

## Coding Style

### Environment Variable Access

Use `requireEnv` and `getEnv` from [projects/hutch/src/require-env.ts](projects/hutch/src/require-env.ts). Never use `process.env` directly.

```typescript
// BAD - Direct process.env access
const apiKey = process.env.API_KEY;

// GOOD - Required env var (throws if not set)
const apiKey = requireEnv('API_KEY');

// GOOD - Optional env var
const proxyUrl = getEnv('HTTPS_PROXY');
```

**Never default missing environment variables.** Always use `requireEnv` and let the process fail if a variable is not set. Do not use `getEnv` with a fallback (e.g., `getEnv("KEY") ?? ""`) to work around CI environments missing secrets. Instead, ensure the CI environment provides the variable. Silent defaults complicate debugging and create behaviour that takes longer to diagnose.

**Exception:** Playwright config files (`playwright.config.*.ts`) must use `process.env` directly. Importing `getEnv`/`requireEnv` causes the playwright process to load `require-env.ts` outside V8 coverage instrumentation, creating uncovered function entries that break the 100% function coverage threshold.

### Comments Document Why, Not What

Do not add comments that explain what code does. Only add comments to explain **why** when the reasoning isn't obvious.

```typescript
// BAD - Explains what (obvious from code)
// Re-export template function
export { createHomePageContent } from './home.template';

// GOOD - Explains why (not obvious)
// Robots noindex because this page contains personal data
robots: 'noindex, nofollow',
```

### Unused Variables

Use underscore prefix (`_`) to indicate intentionally unused variables. Biome is configured to allow this.

### Runtime Validation with Zod

Use [zod](https://zod.dev/) for validating external input at system boundaries (HTTP requests, external API responses). Do NOT use zod for internal function parameters already typed by TypeScript.

| Method | Use case |
|--------|----------|
| `.safeParse()` | User-facing validation |
| `.parse()` | Invalid data indicates a bug |
| `z.infer<>` | Derive TypeScript type from schema |

### Prefer Wrappers Over Global Modifications

When extending functionality (e.g., adding proxy support to fetch), create a wrapper module that exports a decorated version as the default export.

```typescript
// BAD - Modifying global
globalThis.fetch = createProxyFetch();

// GOOD - Wrapper module with same interface
// fetch-with-proxy.ts
export default createProxyFetch();
```

### No Design Pattern Names in Identifiers

Use domain-focused names, not implementation-pattern names.

```typescript
// BAD
interface ArticleRepository { ... }
class ArticleService { ... }

// GOOD
type SaveArticle = (article: Article) => Promise<void>;
type FindArticleById = (id: ArticleId) => Promise<Article | undefined>;
```

### Named Parameters Over Positional When Types Repeat

When a function signature has 2 or more consecutive parameters of the same type (e.g., `(string, string)` or `(number, number)`), use a named parameter object instead. Positional arguments of the same type are easy to swap by accident (connascence of position is weaker than connascence of name).

```typescript
// BAD - Two consecutive strings are easy to swap
type Login = (email: string, password: string) => Promise<LoginResult>;
await auth.login("user@example.com", "password123");

// GOOD - Named parameters prevent accidental swaps
type Login = (credentials: { email: string; password: string }) => Promise<LoginResult>;
await auth.login({ email: "user@example.com", password: "password123" });
```

This does NOT apply when the types differ (e.g., `(string, number)`) or when there is only one parameter.

### Prefer Compile-Time Constraints Over Runtime Validation

When a value has a known finite set of valid options, use TypeScript's type system to make invalid states unrepresentable at compile time. Only fall back to runtime validation when the value comes from outside the type system (user input, external APIs).

```typescript
// BAD - Runtime assert for something the type system can enforce
const mode = requireEnv("PERSISTENCE");
assert(mode === "prod" || mode === "development");

// GOOD - Constrained at compile time via generic
const mode = requireEnv<"prod" | "development">("PERSISTENCE");
// mode is typed as "prod" | "development" — no assert needed
```

### No Default Noop Logger in Production Code

Never default a logger dependency to `noopLogger` in production code. A missing logger silently swallows errors and makes debugging impossible. Always require the caller to pass a logger explicitly. Use `noopLogger` only in test code where logging output is intentionally suppressed.

```typescript
// BAD - Silent failure in production
function createWidget(deps?: { logger?: HutchLogger }) {
	const logger = deps?.logger ?? noopLogger;
}

// GOOD - Logger is required
function createWidget(deps: { logger: HutchLogger }) {
	const logger = deps.logger;
}

// GOOD - noopLogger in tests
const widget = createWidget({ logger: HutchLogger.from(noopLogger) });
```

### Use `assert` for Runtime Invariants

Use `assert` from `node:assert` for runtime invariant checks instead of `if`/`throw`. Assert is more concise, communicates intent clearly, and integrates with coverage tooling (no uncovered branches for the truthy path).

```typescript
// BAD - Verbose, creates coverage branches
if (!entity.properties) {
	throw new Error("Server response entity missing properties");
}

// GOOD - Concise, clear intent
import assert from "node:assert";
assert(entity.properties, "Server response entity missing properties");

// GOOD - Strict equality in test code
import assert from "node:assert/strict";
assert.equal(actual, expected, "Values should match");
```

Use `assert` from `node:assert` in production code (non-strict, allows falsy checking). Use `assert` from `node:assert/strict` in test code for strict equality semantics.

### No Default In-Memory Implementations

Never default a dependency to an in-memory implementation in production code. All dependencies MUST be mandatory and the in-memory or production implementations are explicitly set at the entry point (composition root). In-memory implementations are for tests only.

```typescript
// BAD - Silent fallback to in-memory
function createWidget(deps: { store?: Store }) {
	const store = deps.store ?? initInMemoryStore();
}

// GOOD - Store is required
function createWidget(deps: { store: Store }) {
	const store = deps.store;
}
```

### Branded Types for Domain IDs

Use branded types to prevent mixing up identifiers.

```typescript
type ArticleId = string & { readonly __brand: 'ArticleId' };
type UserId = string & { readonly __brand: 'UserId' };
```

### Avoid TypeScript Type Assertions (`as`)

Do not use `as` to cast types. Type assertions bypass the compiler and create weak connections between modules — if a type changes upstream, `as` silently hides the mismatch instead of producing a compile error.

```typescript
// BAD - Assertion hides type mismatches
const userId = rawValue as UserId;
const item = dbResult.Item.url as string;

// GOOD - Validated factory with Zod + infer
const UserIdSchema = z.string().brand<'UserId'>();
type UserId = z.infer<typeof UserIdSchema>;
const userId = UserIdSchema.parse(rawValue);

// GOOD - Zod schema at system boundary (DynamoDB, HTTP, etc.)
const SavedArticleRow = z.object({
  id: ArticleIdSchema,
  url: z.string(),
  // ...
});
function fromItem(item: Record<string, unknown>): SavedArticle {
  return SavedArticleRow.parse(item);
}
```

**Allowed exceptions:**

| Exception | Reason |
|-----------|--------|
| `as const` | Not a type assertion — narrows literal types |
| Isolated Node.js API wrappers (e.g., `promisify(scrypt)` returning `Buffer`, `requireEnv` generic) | The `as` is already contained in a single wrapper function with no better alternative from the type definitions |
| Test doubles (`{} as unknown as WebDriver`) | Faking external interfaces in tests where full implementation is impractical |

## CLI Commands

### Prefer Longhand Parameters

Always use longhand (full) parameter names in CLI commands for clarity.

```bash
# GOOD - Self-documenting
livereload src --exts html,css,ts --wait 500

# Avoid - Requires API knowledge
livereload src -e html,css,ts -w 500
```

## Test Runner Logging

When logging test phase transitions (e.g., "Running unit tests", "Running E2E tests"), prefix with the project name so it's clear which project is running when multiple projects run together.

```javascript
// BAD - Ambiguous in monorepo output
console.log('\n=== Running E2E tests ===\n')

// GOOD - Clear which project is running
console.log('\n=== Hutch - Running E2E tests ===\n')
```

## CI/CD Guidelines

### Never Bypass Git Commit Hooks

Never use `--no-verify` without explicit human approval. If hooks fail:
1. Investigate the failure
2. Fix the underlying issue
3. Ask the human if you cannot fix it

See the [git-commit skill](./.claude/skills/git-commit/SKILL.md) for pre-commit hook failure diagnostics.

## Architecture

### Project Structure

Monorepo at the repository root. Main application lives in `projects/hutch/src/` with two top-level directories:

- `src/runtime/` — Application code (Express SSR app)
- `src/infra/` — Infrastructure as Code (Pulumi) and Lambda adapter
