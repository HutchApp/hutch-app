---
name: ai-agent-editor
description: Guidelines for writing AI agent documentation (skills, CLAUDE.md, README files). Use when creating or updating documentation that will be consumed by AI agents to avoid context window pollution.
---

# AI Agent Editor Guidelines

Conventions for writing documentation that AI agents consume. The goal is to minimize context window usage while maximizing actionable guidance.

## Core Principle: Discoverability Over Duplication

AI agents can inspect the codebase. Guide the agent to discover information rather than duplicating it inline.

### Reference Code, Don't Duplicate It

```markdown
<!-- ❌ BAD - Duplicates code -->
type PageComponent = { head: HeadComponent; ... }

<!-- ✅ GOOD - References source -->
See [projects/readplace/src/web/component.types.ts](projects/readplace/src/web/component.types.ts)
```

### Reference Commands, Don't Explain Them

```markdown
<!-- ❌ BAD -->
We execute e2e tests using `pnpm nx run flights:test-ui`...

<!-- ✅ GOOD -->
Inspect `project.json` to understand how e2e tests run.
```

### Document Why, Not What

```markdown
<!-- ❌ BAD -->
The booking ID uses a 31-character set and weighted sum algorithm...

<!-- ✅ GOOD -->
The booking ID excludes 0, O, 1, I, L to avoid confusion when read over the phone.
See `projects/readplace/src/domain/booking-id.ts` for implementation.
```

## When to Include Code Examples

Include inline code examples only when:

1. **Pattern contrast** - Good vs bad approaches requiring side-by-side comparison
2. **Conceptual patterns** - Abstract patterns not tied to specific files
3. **New patterns** - Code that doesn't exist in the codebase yet

## Structure Guidelines

| Guideline | Rationale |
|-----------|-----------|
| Use concise headings | Scannable navigation |
| Prefer tables over prose | More scannable, less context |
| Link to external specs | Don't re-document standards |

## Anti-Patterns

| Avoid | Reason |
|-------|--------|
| Directory structure diagrams | Stale when files change; use `ls` |
| Command output examples | Stale with versions; just run the command |
| ASCII workflow diagrams | Hard to maintain; use prose or link externally |

## Self-Application

These guidelines apply to this skill itself. When updating ai-agent-editor:

1. Keep examples minimal and focused on pattern contrast
2. Reference this skill's own principles rather than restating them
3. Delete guidelines that duplicate what can be discovered from other skills
