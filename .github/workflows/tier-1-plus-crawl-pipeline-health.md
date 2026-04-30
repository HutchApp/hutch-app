# Tier 1+ Crawl Pipeline Canary Failure Investigation

You have been triggered because the `Tier 1+ crawl pipeline health` workflow failed on its scheduled run. The canary forces a re-crawl through prod's Lambda via `https://readplace.com/admin/recrawl/<url>` and asserts the parsed article contains a known substring. A failure means prod's Lambda could not parse a URL that real users save — production traffic is also blocked for that fingerprint class (Cloudflare TLS fingerprinting, Fastly JA3, AIA chain gap, oembed flip, parser regression, etc.).

## Your Task

1. **Read the issue body and any follow-up comments.** The issue body links to the failing workflow run.
2. **Identify the failing source(s) and failure mode.** Run `gh run view <RUN_ID> --log-failed` (the run URL is in the issue body) to find:
   - The source `label` (sub-test name) and `url` from `src/packages/crawl-article/scripts/health-sources.ts`.
   - The failure mode — one of:
     - **poll-timeout** — `pollUntilDone` exhausted its 180s budget; the last reader-status is in the assertion message.
     - **terminal failed/unavailable** — `data-reader-status` reached a non-`ready` terminal state; usually an origin block of the Lambda egress IP or a parser crash.
     - **content-mismatch** — `expectedContent` substring was not present in the parsed HTML; usually a parser regression or paywall HTML masquerading as an article.
3. **Follow the canary-failure workflow from the root `CLAUDE.md` verbatim:**
   1. Reproduce the failing fetch locally against the same URL before touching any code.
   2. Find the block (status code, Cloudflare `cf-mitigated` header, body contents) and pick a mitigation that hits the real origin (HTTP/2 fallback, header tweaks, AIA chain chase, oembed, etc.).
   3. Re-run the canary locally (`pnpm nx run @packages/crawl-article:tier-1-plus-pipeline-health`) until the failing source passes — never commit until it does.
   4. Open a draft PR with the fix and a short report covering: failing source, failure mode, root cause, mitigation chosen, why it stays inside the same fingerprint class.
4. **Edit the issue body to remove the `@claude` mention** after you respond. The next scheduled cron will post a fresh comment with `@claude` if the canary is still red — that is what should re-trigger this workflow, not your own edits.

## Important Guidelines

- Follow ALL CLAUDE.md guidelines.
- **Never delete an entry from `src/packages/crawl-article/scripts/health-sources.ts` to make the canary green.** Each entry exists because a real user tried to save that fingerprint class and the crawler broke on it. Removing one silently accepts that readers will get "Sorry, we couldn't save this link" for any URL matching that edge sniffer.
- **Never lower `POLL_TIMEOUT_MS` (180s) or shorten `expectedContent`** to make a flaky source pass. Both exist to surface real prod regressions.
- **Never `--no-verify` the commit.** If pre-commit fails, fix the underlying issue.

## Applicable Skills

- **git-commit** (`.claude/skills/git-commit/SKILL.md`) — Conventional Commits format for any fix commit.
- **test-driven-design** (`.claude/skills/test-driven-design/SKILL.md`) — when the fix touches the crawler or parser code paths.
