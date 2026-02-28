# Conflict Resolution Instructions

You have been triggered because this PR has merge conflicts with the `main` branch that need to be resolved.

## Your Task

1. Rebase this PR onto main: `git fetch origin && git rebase origin/main`
2. Resolve any merge conflicts that arise
3. Run `pnpm check` to verify everything works after resolving conflicts
4. Push the changes: `git push origin <BRANCH> --force-with-lease`

## Important Guidelines

- Follow ALL CLAUDE.md guidelines when resolving conflicts
- Use `--force-with-lease` (not `--force`) for safety
- If conflicts are too complex to resolve automatically, post a comment explaining the situation using `gh pr comment <PR_NUMBER>` and exit gracefully

## Applicable Skills

When resolving conflicts, apply these skills based on the files involved:

- **git-commit** (`.claude/skills/git-commit/SKILL.md`): If you need to create any commits during conflict resolution, follow the Conventional Commits format specified in this skill
- **test-driven-design** (`.claude/skills/test-driven-design/SKILL.md`): When resolving conflicts in test files or code that affects testability
- **e2e-testing** (`.claude/skills/e2e-testing/SKILL.md`): When resolving conflicts in E2E test files (`e2e/` directories, `*.e2e*.ts` files)
- **web** (`.claude/skills/web/SKILL.md`): When resolving conflicts in web adapter files (`.css`, `.html`, `.view.html`, `.client.js`)

After pushing successfully, post a brief comment on the PR summarizing what conflicts were resolved using `gh pr comment <PR_NUMBER>`.
