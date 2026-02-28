# Code Review Instructions

You have been triggered to perform a code review on a pull request.

## CRITICAL: Required Output Format

Your review comment MUST follow this EXACT format. The HTML comment markers are REQUIRED - they trigger downstream automation that auto-fixes issues. If you omit these markers, the automation will not run.

**Complete example of required output format:**

```
<!-- CLAUDE_REVIEW_START -->
<!-- HIGH_PRIORITY_COUNT: 1 -->
<!-- MEDIUM_PRIORITY_COUNT: 2 -->

## High Priority Issues (Must Fix)

### 1. [Issue title]
[Description of the issue]

## Medium Priority Issues

### 1. [Issue title]
[Description]

### 2. [Issue title]
[Description]

## Low Priority Suggestions

### 1. [Suggestion title]
[Description]

<!-- CLAUDE_REVIEW_END -->

[Summary paragraph here]
```

**If no issues found, use 0 for counts:**

```
<!-- CLAUDE_REVIEW_START -->
<!-- HIGH_PRIORITY_COUNT: 0 -->
<!-- MEDIUM_PRIORITY_COUNT: 0 -->

## High Priority Issues (Must Fix)

None found

## Medium Priority Issues

None found

## Low Priority Suggestions

None

<!-- CLAUDE_REVIEW_END -->

cc @FagnerMartinsBrack - No high or medium priority issues found. This PR is ready for human review.
```

## Priority Classification

- **HIGH PRIORITY**: Security vulnerabilities, bugs that will cause runtime errors, data loss risks, breaking changes without migration path. These MUST be fixed before merging.
- **MEDIUM PRIORITY**: Code quality issues, performance concerns, missing error handling, test coverage gaps. Critical guideline violations with no apparent reason. Should be addressed but not blocking.
- **LOW PRIORITY**: Style suggestions, minor improvements, optional refactoring, minor guidelines violations which could be an exception to the rule. Nice to have but not required.

## Review Areas

- Code quality and best practices (per CLAUDE.md guidelines)
- Potential bugs or runtime errors
- Security vulnerabilities
- Performance considerations
- Test coverage

## Applicable Skills

When reviewing code, apply these skills based on the files being changed:

- **test-driven-design** (`.claude/skills/test-driven-design/SKILL.md`): Review test files and testability patterns for adherence to conventions (dependency injection over mocks, partial application, assertion patterns, coverage rules, no negative test assertions, etc.)
- **e2e-testing** (`.claude/skills/e2e-testing/SKILL.md`): Review E2E test files (`e2e/` directories, `*.e2e*.ts` files) for proper selector strategies, action availability patterns, page detection, and FlowRunner usage
- **web** (`.claude/skills/web/SKILL.md`): Review web adapter files (`.css`, `.html`, `.view.html`, `.client.js`) for SSR patterns, BEM naming, test attribute separation, and progressive enhancement
- **git-commit** (`.claude/skills/git-commit/SKILL.md`): Verify commit messages follow Conventional Commits format with proper scope

## Summary Guidelines

- If HIGH_PRIORITY_COUNT is 0 AND MEDIUM_PRIORITY_COUNT is 0: End with "cc @FagnerMartinsBrack - No high or medium priority issues found. This PR is ready for human review."
- If HIGH_PRIORITY_COUNT > 0 OR MEDIUM_PRIORITY_COUNT > 0: End with "This PR has issues that should be addressed before merging."

## CRITICAL: Posting the Review

You MUST use `gh pr comment <PR_NUMBER>` with your Bash tool to post the review as a NEW comment.

**DO NOT use MCP tools like `mcp__github_comment__update_claude_comment` to post the review.** Using MCP tools updates an existing comment, which triggers an `edited` event instead of a `created` event. The downstream automation only triggers on NEW comments (`created` events).

**Correct approach:**
```bash
gh pr comment <PR_NUMBER> --body "<!-- CLAUDE_REVIEW_START -->
<!-- HIGH_PRIORITY_COUNT: N -->
..."
```

## Pre-Post Checklist

Before posting, verify your comment includes:
- [ ] `<!-- CLAUDE_REVIEW_START -->` at the very beginning
- [ ] `<!-- HIGH_PRIORITY_COUNT: N -->` with correct count
- [ ] `<!-- MEDIUM_PRIORITY_COUNT: N -->` with correct count
- [ ] `<!-- CLAUDE_REVIEW_END -->` after all review sections
