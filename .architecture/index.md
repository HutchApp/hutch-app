# Architecture Snapshots

Point-in-time architecture documentation, pinned to the commit hash that the codebase was at when the snapshot was generated. Each subfolder is one self-contained snapshot (Markdown document + rendered SVG diagrams).

A snapshot reflects the code as it existed at that commit. It does not auto-update — re-generate against the new HEAD when something material shifts. **Any file paths referenced inside a past snapshot may have since been renamed, moved, or deleted; treat them as historical artefacts, not as a guide to the current codebase.**

> **For AI agents:** if a user points you at this folder and asks to create a new snapshot, this file is the single source of truth — read it end-to-end and follow every step below. Make no assumptions about file paths, project layout, language, framework, build tool, or package manager based on past snapshots — discover all of that from the current working tree.

---

## Snapshots

| Commit | Date (commit) | Generated | Branch | Subject | Contents |
|---|---|---|---|---|---|
| [`1748f31`](./1748f31/) | 2026-04-18 | 2026-04-19 | `main` | feat(hutch): point share permalinks at /view/<url> instead of /save | Save-link flow event storming — UI submit → Lambda → SQS → EventBridge → datastore, with authenticated and anonymous branches. Three pre-rendered SVG diagrams. |
| [`52017f3`](./52017f3/) | 2026-04-20 | 2026-04-20 | `main` | feat(hutch,save-link,@packages/hutch-infra-components): add summary generation state machine with DLQ | Summary-generation pipeline event storming — LinkSaved/AnonymousLinkSaved dispatch a GenerateSummaryCommand; generator writes ready/skipped and publishes SummaryGenerated; SQS retry exhaustion drives a DLQ handler that flips the row to failed and publishes SummaryGenerationFailed into a parse-errors log. Reader UI polls a pending slot every 3 s up to a 40-poll cap. Four pre-rendered SVG diagrams. |
| [`d5f38258`](./d5f38258/) | 2026-04-24 | 2026-04-24 | `main` | fix(save-link): catch Readability.parse() throws in readability-parser | Article crawl pipeline event storming — authenticated, extension-Tier-0 (raw-DOM from S3), anonymous /view, and admin-recrawl entries all converge on the same save-link worker shape (crawl → parse → markCrawlReady/Failed → publish LinkSaved/AnonymousLinkSaved). Covers the Tier 1+ HTTP waterfall (Twitter oembed, H2 + AIA-chasing fetch, 304 short-circuit), the pluggable site pre-parser system in front of Readability, terminal-vs-transient parse-failure split (inline markCrawlFailed vs SQS-retry → DLQ), and the boundary where LinkSaved hands off to the summary pipeline. Four pre-rendered SVG diagrams. |
| [`bfd85c7`](./bfd85c7/) | 2026-04-24 | 2026-04-24 | `main` | feat(save-link): Tier 0 canonical promotion via Deepseek selector + DLQ consumer | Save-link-raw (extension DOM) flow event storming — toolbar/context-menu click captures rendered DOM via content-script message → POST /queue/save-html stages HTML to a pending bucket and publishes SaveLinkRawHtmlCommand in parallel with the Tier-1 SaveLinkCommand. The raw-HTML worker parses, rewrites media, writes a tier-0 source, reads any existing canonical, and either promotes immediately (canonical empty) or runs a Deepseek JSON-mode selector to pick the more complete body; promotion is an S3 CopyObject + Dynamo UpdateItem and only then publishes LinkSaved, keeping the summary pipeline idempotent on losses. A dedicated DLQ consumer flips the article to crawlStatus=failed and emits CrawlArticleFailed when the queue exceeds maxReceiveCount. Four pre-rendered SVG diagrams. |
| [`a6949fd`](./a6949fd/) | 2026-04-28 | 2026-04-30 | `feat/tier-content-selector` | feat: extract content selector into its own Lambda; tier sources are first-class | Tier-content selector flow event storming — workers stop touching canonical and instead write per-tier source slots (HTML + JSON metadata sidecar) and emit the new past-tense TierContentExtractedEvent. A new select-most-complete-content Lambda subscribes to that event, lists available per-tier sources from S3, runs the Deepseek selector when there is competition (short-circuits on a single tier), and is the only thing that promotes to canonical. The selector emits LinkSaved/AnonymousLinkSaved (only on canonical change) and CrawlArticleCompleted (every successful selection); the summary pipeline trigger relocates with these events. A new contentSourceTier column on the article row and a UI badge on the admin recrawl page surface which tier is in canonical. Recrawl now reconsiders any prior tier-0 source automatically — fixes the previous regression where a paywalled origin's HTTP recrawl could overwrite a strictly-better extension capture. Four pre-rendered SVG diagrams. |

---

## AI prompt — generate a new snapshot

Hand this verbatim to a fresh agent (replace `<TOPIC>` and `<ENTRY>` first if you want to skip the inference step; otherwise leave them and let the agent infer from the surrounding ask).

> Read `.architecture/index.md` end-to-end before doing anything else. It is the single source of truth for this task. Make no assumptions about file paths, project layout, language, framework, build tool, or package manager based on past snapshots — discover all of that from the current working tree.
>
> Create a new architecture snapshot for `<TOPIC>` starting from `<ENTRY>` (an HTTP route, CLI command, queue consumer, scheduled job, webhook, or UI action). If `<TOPIC>` and `<ENTRY>` are not given, infer them from the user's request and confirm only if ambiguous.
>
> **Step 0 — Establish context from scratch.** Treat the repo as unknown. Find the project root (highest-level `.git/`); read top-level `README*`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` to absorb domain language and layout. Detect the package manager and build tool from manifests (`package.json` + lockfile, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc.) and use whatever the project uses. Choose a short kebab-case slug for the snapshot file/folder name. Locate the entry point in the code by searching for the most distinctive symbol or path the user mentioned; search synonyms before asking.
>
> **Step 1 — Capture the commit context.** Run `git rev-parse --short HEAD` (→ `<hash>`), `git show -s --format='%ai%n%s' HEAD` (→ commit date + subject), `git rev-parse --abbrev-ref HEAD` (→ branch). Create `.architecture/<hash>/`. If the working tree is dirty, surface that to the user before proceeding.
>
> **Step 2 — Map the system.** Apply event-storming notation: **command → system → event(s)**, then the commands triggered by each event. Inside every step, surface the underlying infrastructure (handlers, queues / DLQs, queue policies, event-bus rules, datastore reads/writes, external APIs, scheduled rules). Cover every code path that branches off the entry — including parallel, anonymous, retry, fallback, and error variants. Walk the call graph outward from the entry until each chain terminates (a write with no further publish, a logger, an HTTP response). Discover source files yourself with file search (glob/grep), starting from the entry-point keyword and following imports / publish-subscribe pairs. Do not rely on any file list from past snapshots.
>
> Write the diagram as Mermaid `flowchart` blocks inside `.architecture/<hash>/<TOPIC>.md`. Include a Legend block at the top. Each Mermaid block must declare its own `classDef`s (the SVG renderer treats each block in isolation). Use this colour convention so all snapshots stay visually consistent:
>
> | Role | Fill | Stroke |
> |---|---|---|
> | Command | `#a6d8ff` | `#1e6fb8` |
> | System / aggregate | `#fff2a8` | `#a08a00` |
> | Event | `#ffb976` | `#a85800` |
> | Policy / reaction | `#d6b8ff` | `#6b3fb0` |
> | Read model / store | `#b8e8c5` | `#2f7a45` |
> | Queue | `#e8e8e8` | `#666` |
> | DLQ | `#f8c8c8` | `#a83434` |
>
> After the diagrams, include a **Command → System → Event(s) reference table** that lists every command and event with: the system that handles it, the event(s) emitted, and the next command(s) those events trigger. This is the textual index of the diagram and what most readers will scan first.
>
> **Step 3 — Render diagrams to SVG.** Mermaid blocks must be pre-rendered so the document opens in any standard Markdown viewer (MacDown, GitHub, Quicklook, browsers) without a plugin. Run:
>
> ```bash
> cd .architecture/<hash>
> mkdir -p diagrams
> npx -y -p @mermaid-js/mermaid-cli mmdc \
>   -i <TOPIC>.md \
>   -o diagrams/<TOPIC>.svg \
>   --backgroundColor white
> ```
>
> `mmdc` writes one SVG per Mermaid block, numbered `<TOPIC>-1.svg`, `<TOPIC>-2.svg`, etc. Rename them to descriptive filenames (e.g. `legend.svg`, `end-to-end-flow.svg`). In the Markdown document, embed each SVG with `![alt](diagrams/<name>.svg)` and keep the original Mermaid source in a collapsed `<details><summary>Mermaid source</summary>...</details>` block underneath so the diagram can be re-rendered. If `mmdc` fails (network, sandbox, missing Chromium), surface the error to the user before proceeding — do not leave raw unrendered Mermaid blocks in the snapshot.
>
> **Step 4 — Update the snapshots table in `.architecture/index.md`.** Append a row with: commit short hash linked to the folder (`[\`<hash>\`](./<hash>/)`), commit date, today's date, branch, commit subject, a one-line contents summary that does **not** reference current file paths (those may rot — describe the flow at the level of "X submits → Y processes → Z stores"). Keep snapshots in chronological order (newest at the bottom).
>
> **Step 5 — Do not commit.** Leave everything in the working tree. The user controls when to commit.

---

## Maintenance

When a past snapshot becomes substantially wrong (the underlying flow has been redesigned), do not edit the old snapshot — it is a historical record. Generate a new snapshot at the current commit instead.
