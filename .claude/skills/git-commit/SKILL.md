---
name: git-commit
description: Format git commit messages following Conventional Commits specification. Use when the user asks to commit, create a commit, stage and commit, write a commit message, or mentions "git commit". Applies to all commits in this monorepo.
---

# Git Commit Message Convention

This monorepo follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Refer to that specification for format details, types, and breaking change conventions.

## Scope Rules

The scope **must** be the `name` property from the project's `package.json` where the files are being changed. Inspect `projects/*/package.json` to find valid scope names.

| Scenario | Format |
|----------|--------|
| Single project | `type(project): description` |
| 2-3 projects | `type(project1,project2): description` |
| More than 3 projects | `type: description` (omit scope) |
| Root/monorepo only | `type: description` (omit scope) |

## How to Determine the Scope

1. Check which files are being committed using `git status` and `git diff --staged`
2. Identify which project directory each file belongs to (e.g., `projects/flights/`)
3. Look up the `name` field in that project's `package.json`

## Important Notes

- Always use lowercase for type and scope
- Keep the description concise (ideally under 72 characters)
- Use imperative mood ("add" not "added" or "adds")

## Pre-commit Hook Failures

When the pre-commit hook fails, follow this diagnostic process **before** asking the user to bypass hooks:

### Step 1: Pull Latest from Upstream

```bash
git stash --include-untracked
git pull --rebase origin main
git stash pop
```

### Step 2: Verify if Issue is Pre-existing

```bash
git stash --include-untracked
pnpm check  # Run on clean main
```

- If clean main passes: The issue is with your changes. Restore with `git stash pop` and investigate.
- If clean main fails: The issue is pre-existing. Report this to the user.

### Step 3: Handle Stale Coverage Data

If coverage shows 0% for new files, run a fresh test cycle:

```bash
pnpm compile && pnpm test
```

### Step 4: Fix Failing Tests

If tests fail after your changes, update the tests to match the new behavior rather than asking to bypass hooks.

### Never Bypass Hooks Without User Approval

Only ask to bypass with `--no-verify` after completing the diagnostic steps above and confirming the issue is genuinely pre-existing.
