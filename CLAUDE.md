# Development Guidelines

## Architecture Guidelines

### Web Adapter Conventions

For HTML/CSS/SSR conventions, see the [web skill](./.claude/skills/web/SKILL.md).

### Test Driven Design

For testing conventions and designing testable code, see the [test-driven-design skill](./.claude/skills/test-driven-design/SKILL.md).

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

### Comments Document Why, Not What

Do not add comments that explain what code does. Only add comments to explain **why** when the reasoning isn't obvious.

```typescript
// BAD - Explains what (obvious from code)
// Re-export template function
export { createLandingPageContent } from './landing.template';

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

### Branded Types for Domain IDs

Use branded types to prevent mixing up identifiers.

```typescript
type ArticleId = string & { readonly __brand: 'ArticleId' };
type UserId = string & { readonly __brand: 'UserId' };
```

## CLI Commands

### Prefer Longhand Parameters

Always use longhand (full) parameter names in CLI commands for clarity.

```bash
# GOOD - Self-documenting
livereload src --exts html,css,ts --wait 500

# Avoid - Requires API knowledge
livereload src -e html,css,ts -w 500
```

## CI/CD Guidelines

### Never Bypass Git Commit Hooks

Never use `--no-verify` without explicit human approval. If hooks fail:
1. Investigate the failure
2. Fix the underlying issue
3. Ask the human if you cannot fix it

See the [git-commit skill](./.claude/skills/git-commit/SKILL.md) for pre-commit hook failure diagnostics.
