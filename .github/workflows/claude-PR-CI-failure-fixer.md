# CI Failure Fix Instructions

You have been triggered because CI has failed on a pull request.

## Your Task

1. Run `gh run view <RUN_ID> --log-failed` to see detailed logs (the run ID is provided in the comment that triggered you)
2. Analyze the failure and identify the root cause
3. Implement the fix - focus ONLY on fixing the CI failure, do not make unrelated changes
4. Run `pnpm check` to verify your fix works before pushing
5. Commit with message: `fix: resolve CI failure (attempt #N)` where N is the attempt number from the triggering comment
6. Push: `git pull --rebase origin <BRANCH> && git push origin <BRANCH>`
7. Comment on PR with summary: `gh pr comment <PR_NUMBER>`

## Important Guidelines

- Follow ALL CLAUDE.md guidelines when making fixes
- If git push fails due to conflicts: do NOT force push, try to resolve, or comment and exit gracefully
- Focus only on fixing the CI failure - do not refactor or improve unrelated code

## Applicable Skills

When fixing CI failures, apply these skills based on the type of failure:

- **git-commit** (`.claude/skills/git-commit/SKILL.md`): Follow the Conventional Commits format when creating fix commits
- **test-driven-design** (`.claude/skills/test-driven-design/SKILL.md`): When fixing test failures, coverage issues, or violations of testing conventions (dependency injection, assertion patterns, etc.)
- **e2e-testing** (`.claude/skills/e2e-testing/SKILL.md`): When fixing E2E test failures, including locator timeouts, FlowRunner issues, or Playwright-related errors
- **web** (`.claude/skills/web/SKILL.md`): When fixing issues in web adapter files (CSS selector issues, SSR patterns, client-side JS, HTML templates)

## Diagnosing GitHub Actions Failures

GitHub Actions logs can be misleading due to output buffering. Follow this systematic approach to identify the actual root cause:

**1. Understand log buffering artifacts:**
- All stdout/stderr is buffered and flushed when the process exits
- Timestamps may all show the same second even for operations that took minutes
- Progress bars (e.g., Chromium download) can appear to fail mid-way, but this is a display artifact from buffered output being truncated

**2. Look at the END of the build for actual errors:**
- Coverage threshold failures appear after all tests complete
- The visible "error" in the middle of logs is often not the real cause
- Search for: `threshold`, `Coverage`, `ELIFECYCLE`, `exit code`

**3. Compare passing vs failing PRs:**
```bash
# Get workflow runs for comparison
gh pr checks <pr-number> --repo owner/repo
gh run view <run-id> --repo owner/repo --log-failed
```

**4. Common red herrings:**
- `ELIFECYCLE` error after progress bar - Usually means a later step failed, not the download
- Multiple "errors" in log - The LAST error is usually the real cause

**Example investigation flow:**
```bash
# 1. Get failed job details
gh pr checks <pr-number> --repo HutchApp/hutch-app

# 2. Search logs for actual error (usually at the end)
gh run view <run-id> --log-failed 2>&1 | grep -E "threshold|Coverage|FAILURE"

# 3. Run locally to reproduce
CI=true pnpm check
```

**Rationale:** Log buffering in CI systems makes the first visible error often not the root cause.
