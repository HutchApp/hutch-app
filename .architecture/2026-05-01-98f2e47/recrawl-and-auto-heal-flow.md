# Recrawl & Auto-Heal Flow — Event Storming

**Commit:** `98f2e47` &nbsp;•&nbsp; **Commit date:** 2026-05-01 &nbsp;•&nbsp; **Generated:** 2026-05-01 &nbsp;•&nbsp; **Branch:** `main`
**Subject:** `chore: bump firefox extension version to 1.0.82`

A point-in-time map of the **post-tier-selector recrawl + auto-heal pipeline**. The previous snapshot ([`a6949fd`](../2026-04-28-a6949fd/tier-content-selector-flow.md)) captured the new tier-content selector but described admin recrawl as "unchanged at the entry-point layer — the existing `SaveAnonymousLinkCommand` path now writes a fresh `sources/tier-1.html`." That note is now obsolete: a dedicated **recrawl** event chain exists.

What is new in this snapshot:

- A purpose-built **`RecrawlLinkInitiatedEvent` → `RecrawlContentExtractedEvent` → `RecrawlCompletedEvent`** chain replaces the prior reuse of `SaveAnonymousLinkCommand` for admin-triggered re-fetch. Two new Lambdas back it: `recrawl-link-initiated` (re-runs the save-link work — crawl, parse, media rewrite, `markCrawlReady`, write `sources/tier-1.html` + sidecar) and `recrawl-content-extracted` (a near-clone of `select-most-complete-content` that **always** dispatches `GenerateSummaryCommand` regardless of whether canonical changed). Each has its own SQS queue + DLQ handler; both DLQ paths flip `crawlStatus=failed` and emit `CrawlArticleFailedEvent`.
- The reason for the new chain: recrawl is the operator opting out of the canonical-change dedup gate so the AI excerpt is regenerated every time. The user-save selector still gates `LinkSaved` / `AnonymousLinkSaved` on canonical change to keep the summary pipeline idempotent on losses; the recrawl selector skips the gate by design.
- The `/admin/recrawl/<url>` route force-flips both `crawlStatus` and the summary row to `pending` (via `forceMarkCrawlPending` / `forceMarkSummaryPending` — overrides on top of the regular state machine) before publishing `RecrawlLinkInitiatedEvent`. This way the reader UI shows the "recrawl in progress" skeleton immediately and the summariser short-circuit on the cached `ready` row is bypassed.
- The article reader (`/view/<url>`, `/queue`, `/admin/recrawl/<url>` polls) now contains two healing branches that did not exist in past snapshots: (1) **legacy-stub healing** in `resolveReaderState` re-primes both pipelines when the article row exists but carries no `crawlStatus` and no summary state attribute (rows from before the state machines); (2) **promotion-race polling** keeps the reader-slot polling open when `crawlStatus="ready"` but `readArticleContent` still returns `undefined` — the selector flipped the row before the S3 `CopyObject` for canonical landed.
- Anonymous `/view/<url>` carries its own auto-heal at the **freshness layer**, distinct from the recrawl chain. `refreshArticleIfStale` returns `"reprime"` when the row exists with `crawlStatus="failed"`, which `view.page.ts` handles by calling `markCrawlPending` + `markSummaryPending` and re-publishing `SaveAnonymousLinkCommand`. This path **does not** publish `RecrawlLinkInitiatedEvent` — recrawl is admin-only; the anonymous heal reuses the regular save-anonymous worker.
- The summary pipeline now produces a **second output alongside the summary**: a one-or-two-sentence `excerpt`. Both come from a single Deepseek call with a `json_schema` output config, are written together by `saveGeneratedSummary`, and carry the `excerpt` as an optional field on the `GeneratedSummary` read model. Article-list views render the AI excerpt in place of the original Readability excerpt when present.
- The reader page renders a unified single-bar **progress indicator** (`progress-bar.component`) driven by `buildUnifiedProgress` in the article-reader core. It picks whichever pipeline (crawl or summary) is further along, maps that pipeline's `stage` attribute to a percentage on the 0–100 scale, and short-circuits to "no animation" when the crawl has failed or both pipelines have reached terminal states. The bar is updated out-of-band on each reader/summary poll via `renderProgressBarOob`.

> Snapshots are historical. Any file path referenced below may be renamed, moved, or deleted in the future. Treat as an artefact, not a live guide.

---

## Legend

![Legend](diagrams/legend.svg)

<details><summary>Mermaid source</summary>

```mermaid
flowchart LR
    classDef command fill:#a6d8ff,stroke:#1e6fb8,color:#000
    classDef system  fill:#fff2a8,stroke:#a08a00,color:#000
    classDef event   fill:#ffb976,stroke:#a85800,color:#000
    classDef policy  fill:#d6b8ff,stroke:#6b3fb0,color:#000
    classDef store   fill:#b8e8c5,stroke:#2f7a45,color:#000
    classDef queue   fill:#e8e8e8,stroke:#666,color:#000
    classDef dlq     fill:#f8c8c8,stroke:#a83434,color:#000

    C[Command]:::command
    S[System / aggregate]:::system
    E[Event]:::event
    P[Policy / reaction]:::policy
    R[Read model / store]:::store
    Q[(Queue)]:::queue
    D[(DLQ)]:::dlq
```

</details>

---

## Admin recrawl flow — `/admin/recrawl/<url>` to fresh excerpt

The admin recrawl entry point is the **only** publisher of `RecrawlLinkInitiatedEvent`. The route force-flips both pipelines back to `pending`, publishes the recrawl event, then renders the reader skeleton. The downstream Lambdas re-fetch from origin, re-run the tier selector against the fresh sources, and dispatch `GenerateSummaryCommand` unconditionally so a fresh summary + excerpt always lands.

![Admin recrawl flow](diagrams/admin-recrawl-flow.svg)

<details><summary>Mermaid source</summary>

```mermaid
flowchart TD
    classDef command fill:#a6d8ff,stroke:#1e6fb8,color:#000
    classDef system  fill:#fff2a8,stroke:#a08a00,color:#000
    classDef event   fill:#ffb976,stroke:#a85800,color:#000
    classDef policy  fill:#d6b8ff,stroke:#6b3fb0,color:#000
    classDef store   fill:#b8e8c5,stroke:#2f7a45,color:#000
    classDef queue   fill:#e8e8e8,stroke:#666,color:#000
    classDef dlq     fill:#f8c8c8,stroke:#a83434,color:#000

    %% Entry
    Admin([GET /admin/recrawl/<url><br/>requireAdmin middleware]):::policy
    Find[findArticleByUrl<br/>404 if missing — explicit human intervention only]:::system
    Articles[(DynamoDB articles)]:::store
    Admin --> Find
    Find <--> Articles

    %% Force-pending overrides
    ForceCrawl[forceMarkCrawlPending<br/>flips even ready/failed rows back to pending]:::system
    ForceSum[forceMarkSummaryPending<br/>flips even ready/skipped rows back to pending]:::system
    Find --> ForceCrawl
    Find --> ForceSum
    ForceCrawl --> Articles
    ForceSum --> Articles

    %% Recrawl event
    RLI[RecrawlLinkInitiatedEvent<br/>url<br/>source=hutch.api]:::event
    Find --> RLI

    Bus{{EventBridge default-bus}}:::system
    RLI --> Bus

    QRLI[(recrawl-link-initiated<br/>vis 60s, maxReceive 3)]:::queue
    Bus --> QRLI

    %% Step 1: re-fetch + re-parse + write tier-1 source
    RLIWorker[recrawl-link-initiated Lambda<br/>shares saveLinkWork with Tier-1 path<br/>logPrefix RecrawlLinkInitiated]:::system
    QRLI --> RLIWorker

    Origin[Origin HTTP/2 fetch<br/>readability-parser + site pre-parsers]:::system
    RLIWorker <--> Origin

    S3Tier1[(S3 articles/&lt;id&gt;/sources/tier-1.html<br/>+ tier-1.metadata.json)]:::store
    RLIWorker -- putTierSource --> S3Tier1
    RLIWorker -- markCrawlReady --> Articles
    RLIWorker -- updateFetchTimestamp<br/>etag, lastModified, contentFetchedAt --> Articles

    %% Step 2: extracted event
    RCE[RecrawlContentExtractedEvent<br/>url<br/>source=hutch.save-link]:::event
    RLIWorker -.publish.-> RCE
    RCE --> Bus

    QRCE[(recrawl-content-extracted<br/>vis 90s, maxReceive 3)]:::queue
    Bus --> QRCE

    %% Step 3: re-run selector (NO canonical-change gate)
    RCEWorker[recrawl-content-extracted Lambda<br/>list sources, run Deepseek if competition,<br/>promote, ALWAYS dispatch summary]:::system
    QRCEWorker_in[(see selector internals diagram)]:::policy
    QRCE --> RCEWorker
    RCEWorker -.same listing/contest logic.-> QRCEWorker_in

    %% S3 sources read
    S3Tier0[(S3 articles/&lt;id&gt;/sources/tier-0.html<br/>+ sidecar; preserved across recrawls)]:::store
    RCEWorker <-- listAvailableTierSources --> S3Tier0
    RCEWorker <-- listAvailableTierSources --> S3Tier1

    %% Canonical promotion only when winner !== tie
    S3Canon[(S3 content/&lt;id&gt;/content.html<br/>canonical bytes)]:::store
    RCEWorker -- promoteTierToCanonical<br/>S3 CopyObject + Dynamo SET<br/>contentSourceTier --> S3Canon
    RCEWorker --> Articles

    %% Always-dispatch GenerateSummary — recrawl opts out of canonical-change gate
    GSC[GenerateSummaryCommand<br/>direct SQS dispatch<br/>via initSqsCommandDispatcher]:::command
    RCEWorker -. inline dispatch every time .-> GSC
    QGS[(generate-summary<br/>shared with user-save chain)]:::queue
    GSC --> QGS

    %% Recrawl completion event (no LinkSaved / AnonymousLinkSaved on this path)
    RComplete[RecrawlCompletedEvent<br/>url]:::event
    RCEWorker -.publish.-> RComplete
    RComplete --> Bus

    %% Summary pipeline (refreshes excerpt, alongside summary)
    GSWorker[generate-summary Lambda<br/>see 52017f3 snapshot for state machine]:::system
    QGS --> GSWorker
    Sum[(DynamoDB summary attrs<br/>summary, excerpt, tokens)]:::store
    GSWorker --> Sum

    %% Why force-pending matters: short-circuit guard
    Note[summariser short-circuits on cache hit when status is ready/skipped<br/>forceMarkSummaryPending flips it back to pending so it regenerates]:::policy
    ForceSum -. enables .-> Note
    Note -. unblocks .-> GSWorker
```

</details>

---

## Anonymous /view auto-heal — distinct path, reuses save-anonymous chain

Anonymous viewers hitting `/view/<url>` get their own auto-heal path that **does not** publish `RecrawlLinkInitiatedEvent`. The freshness layer reads the article row + crawl status and returns one of `new` / `reprime` / `skip` / `unchanged` / `refreshed`. The `reprime` action is the auto-heal: it fires when the article row exists but `crawlStatus="failed"` (or the crawl row is missing), and it re-uses the regular `SaveAnonymousLinkCommand` worker — no recrawl event needed because the worker already does the right thing for first-visit and re-prime cases (writes a fresh `sources/tier-1.html` and lets the user-save selector decide).

![View auto-heal flow](diagrams/view-auto-heal-flow.svg)

<details><summary>Mermaid source</summary>

```mermaid
flowchart TD
    classDef command fill:#a6d8ff,stroke:#1e6fb8,color:#000
    classDef system  fill:#fff2a8,stroke:#a08a00,color:#000
    classDef event   fill:#ffb976,stroke:#a85800,color:#000
    classDef policy  fill:#d6b8ff,stroke:#6b3fb0,color:#000
    classDef store   fill:#b8e8c5,stroke:#2f7a45,color:#000
    classDef queue   fill:#e8e8e8,stroke:#666,color:#000
    classDef dlq     fill:#f8c8c8,stroke:#a83434,color:#000

    %% Entry
    View([GET /view/&lt;url&gt;<br/>anonymous, no auth]):::policy
    Validate[ViewUrlSchema.safeParse<br/>+ scheme normalisation https:/ → https://]:::system
    View --> Validate
    Bad[render SaveErrorPage]:::policy
    Validate -- invalid --> Bad

    %% Freshness check
    Fresh[refreshArticleIfStale<br/>findArticleFreshness + findArticleCrawlStatus]:::system
    Validate --> Fresh
    Articles[(DynamoDB articles<br/>contentFetchedAt, etag, lastModified, crawlStatus)]:::store
    Fresh <--> Articles

    Decision{action}:::policy
    Fresh --> Decision

    %% Branches
    New[action=new<br/>row missing entirely]:::policy
    Reprime[action=reprime<br/>crawl missing or status=failed<br/>auto-heal trigger]:::policy
    Skip[action=skip<br/>fresh, parse failed, or fetch failed]:::policy
    Unchanged[action=unchanged<br/>304 not-modified<br/>publish UpdateFetchTimestamp]:::policy
    Refreshed[action=refreshed<br/>fetched + parsed<br/>publish RefreshArticleContent]:::policy
    Decision -- "no row" --> New
    Decision -- "crawl failed/missing" --> Reprime
    Decision -- "&lt; staleTtlMs" --> Skip
    Decision -- "304" --> Unchanged
    Decision -- "200 + parse ok" --> Refreshed

    %% New: write stub + prime + publish save-anonymous
    Stub[saveArticleGlobally stub<br/>title=hostname, excerpt='', wordCount=0]:::system
    MarkC1[markCrawlPending]:::system
    MarkS1[markSummaryPending]:::system
    PubSAL1[publishSaveAnonymousLink]:::system
    New --> Stub --> MarkC1 --> MarkS1 --> PubSAL1
    Stub --> Articles
    MarkC1 --> Articles
    MarkS1 --> Articles

    %% Reprime: same primer + publish — NO RecrawlLinkInitiated here
    MarkC2[markCrawlPending]:::system
    MarkS2[markSummaryPending]:::system
    PubSAL2[publishSaveAnonymousLink<br/>NB: NOT publishRecrawlLinkInitiated<br/>recrawl is admin-only]:::system
    Reprime --> MarkC2 --> MarkS2 --> PubSAL2
    MarkC2 --> Articles
    MarkS2 --> Articles

    %% Both publishes funnel into the same SaveAnonymousLinkCommand chain
    SAL[SaveAnonymousLinkCommand<br/>url]:::command
    PubSAL1 --> SAL
    PubSAL2 --> SAL
    Bus{{EventBridge default-bus}}:::system
    SAL --> Bus
    QSAL[(save-anonymous-link-command<br/>see tier-content-selector snapshot)]:::queue
    Bus --> QSAL

    %% Refreshed: in-flight fetch from freshness layer already wrote refresh command
    RAC[RefreshArticleContentCommand<br/>updates metadata in place]:::command
    UFT[UpdateFetchTimestampCommand<br/>etag/lastModified bookkeeping]:::command
    Refreshed -.publishRefreshArticleContent.-> RAC
    Unchanged -.publishUpdateFetchTimestamp.-> UFT
    RAC --> Bus
    UFT --> Bus

    %% Render path: re-read after primer, then resolveReaderState
    ReRead[findArticleByUrl<br/>re-read after any primer write]:::system
    Decision --> ReRead
    ReRead --> Articles
    Reader[initArticleReader.resolveReaderState]:::system
    ReRead --> Reader
    Renders[render ViewPage<br/>reader-slot + summary-slot + progress bar]:::policy
    Reader --> Renders
```

</details>

---

## Reader resolution — legacy-stub heal + promotion-race polling + unified progress

The article reader is shared between `/view/<url>` (anonymous), `/queue` (authenticated list), and `/admin/recrawl/<url>` (admin operator). It is responsible for three independent concerns: (1) deciding whether to keep polling the reader-slot, (2) healing pre-state-machine "legacy stub" rows, and (3) computing the unified progress tick that is sent out-of-band to the page-level progress bar.

![Reader resolution](diagrams/reader-resolution.svg)

<details><summary>Mermaid source</summary>

```mermaid
flowchart TD
    classDef command fill:#a6d8ff,stroke:#1e6fb8,color:#000
    classDef system  fill:#fff2a8,stroke:#a08a00,color:#000
    classDef event   fill:#ffb976,stroke:#a85800,color:#000
    classDef policy  fill:#d6b8ff,stroke:#6b3fb0,color:#000
    classDef store   fill:#b8e8c5,stroke:#2f7a45,color:#000
    classDef queue   fill:#e8e8e8,stroke:#666,color:#000
    classDef dlq     fill:#f8c8c8,stroke:#a83434,color:#000

    %% Entry to reader core
    Caller([resolveReaderState / handleReaderPoll / handleSummaryPoll<br/>called by /view, /queue, /admin/recrawl]):::policy

    Read1[findArticleCrawlStatus]:::system
    Read2[findGeneratedSummary]:::system
    Read3[readArticleContent<br/>S3 GetObject content/&lt;id&gt;/content.html]:::system
    Articles[(DynamoDB articles<br/>crawlStatus, summaryStatus, summary, excerpt)]:::store
    S3[(S3 content bucket<br/>canonical bytes)]:::store

    Caller --> Read1 --> Articles
    Caller --> Read2 --> Articles
    Caller --> Read3 --> S3

    %% Legacy-stub healing
    Both{crawl undefined<br/>AND summary undefined?}:::policy
    Read1 --> Both
    Read2 --> Both
    HealC[markCrawlPending]:::system
    HealS[markSummaryPending]:::system
    ReReadCS[re-read crawl + summary]:::system
    Both -- yes, legacy stub --> HealC --> HealS --> ReReadCS --> Articles
    Both -- no --> KeepPoll

    %% Reader poll decision (3 cases)
    KeepPoll{shouldKeepPollingReader}:::policy
    KeepPoll -- "crawl=pending" --> Poll1[case 1: in-flight]:::policy
    KeepPoll -- "crawl=undefined AND content=undefined" --> Poll2[case 2: read-after-write race<br/>markCrawlPending hasn't propagated]:::policy
    KeepPoll -- "crawl=ready AND content=undefined" --> Poll3[case 3: promotion race<br/>selector flipped row before S3 CopyObject]:::policy
    KeepPoll -- "ready+content OR failed" --> Stop[stop polling]:::policy

    Poll1 --> Bound{pollCount &lt; 40?}:::policy
    Poll2 --> Bound
    Poll3 --> Bound
    Bound -- yes --> NextPoll[set readerPollUrl<br/>?poll=N+1<br/>HTMX swap continues]:::policy
    Bound -- no, exhausted --> Stop

    %% Summary slot (separate poll loop, same MAX_POLLS)
    SumPoll{summary status<br/>=== pending<br/>AND not crawl-failed<br/>AND pollCount &lt; 40?}:::policy
    Read2 --> SumPoll
    SumPoll -- yes --> SumPollUrl[set summaryPollUrl]:::policy
    SumPoll -- no --> SumStop[summary slot terminal<br/>collapse if failed/skipped]:::policy

    %% Unified progress bar
    Progress[buildUnifiedProgress<br/>pick further-along pipeline]:::system
    Read1 --> Progress
    Read2 --> Progress
    BarOut{progress source}:::policy
    Progress --> BarOut
    BarOut -- "crawl=failed" --> NoBar[undefined - hide bar]:::policy
    BarOut -- "crawl=pending" --> CrawlPct[CRAWL_STAGE_TO_PCT - lower half]:::policy
    BarOut -- "summary pipeline" --> SumPct[SUMMARY_STAGE_TO_PCT - upper half]:::policy
    BarOut -- "both terminal" --> NoBar

    %% OOB swap on every poll
    Oob[renderProgressBarOob<br/>HTMX hx-swap-oob to id=progress-bar]:::system
    CrawlPct --> Oob
    SumPct --> Oob
    NoBar --> Oob

    %% Excerpt propagation (new since prior snapshot)
    Excerpt[GeneratedSummary.excerpt<br/>1 or 2 short sentences, max 280 chars]:::store
    Read2 --> Excerpt
    ListUI[Article-list views<br/>render AI excerpt when present<br/>fallback to Readability excerpt]:::policy
    Excerpt --> ListUI
```

</details>

---

## Failure paths — recrawl DLQs converge on the same `CrawlArticleFailedEvent`

Both new recrawl Lambdas have their own DLQs. After `maxReceiveCount=3` exhaustions on either queue, a `HutchDLQEventHandler` Lambda parses the original event body, flips `crawlStatus=failed` with `reason="exceeded SQS maxReceiveCount"`, and publishes the same terminal `CrawlArticleFailedEvent` that the user-save chain DLQs publish. The DLQ-arrival CloudWatch alarms wired by `HutchSQSBackedLambda` page `alertEmail` via SNS the moment a message lands in either DLQ.

The `recrawl-content-extracted` handler also has an in-band retry: if `listAvailableTierSources` returns zero (an S3-list-vs-event-delivery race), the Lambda throws so SQS redelivers after the visibility timeout. Convergence is the same as the user-save selector's race — usually fixed on the second attempt; only after `maxReceiveCount` does the message land in the DLQ.

![Failure paths](diagrams/failure-paths.svg)

<details><summary>Mermaid source</summary>

```mermaid
flowchart TD
    classDef command fill:#a6d8ff,stroke:#1e6fb8,color:#000
    classDef system  fill:#fff2a8,stroke:#a08a00,color:#000
    classDef event   fill:#ffb976,stroke:#a85800,color:#000
    classDef policy  fill:#d6b8ff,stroke:#6b3fb0,color:#000
    classDef store   fill:#b8e8c5,stroke:#2f7a45,color:#000
    classDef queue   fill:#e8e8e8,stroke:#666,color:#000
    classDef dlq     fill:#f8c8c8,stroke:#a83434,color:#000

    %% Recrawl queues + DLQs
    QRLI[(recrawl-link-initiated<br/>vis 60s)]:::queue
    QRCE[(recrawl-content-extracted<br/>vis 90s)]:::queue

    DLQ_RLI[(recrawl-link-initiated-dlq)]:::dlq
    DLQ_RCE[(recrawl-content-extracted-dlq)]:::dlq

    QRLI -. exceed maxReceiveCount=3 .-> DLQ_RLI
    QRCE -. exceed .-> DLQ_RCE

    %% In-band retry: zero sources race
    NoSources{listAvailableTierSources<br/>returned 0?}:::policy
    QRCE --> NoSources
    NoSources -- yes --> Throw[throw — let SQS redeliver after vis timeout]:::policy
    Throw -. up to 3x .-> QRCE
    Throw -. eventually .-> DLQ_RCE

    %% DLQ handlers — HutchDLQEventHandler shape
    DH_RLI[recrawl-link-initiated-dlq Lambda<br/>parses RecrawlLinkInitiatedEvent.detail]:::system
    DH_RCE[recrawl-content-extracted-dlq Lambda<br/>parses RecrawlContentExtractedEvent.detail]:::system

    DLQ_RLI --> DH_RLI
    DLQ_RCE --> DH_RCE

    %% Common failure write
    Mark[markCrawlFailed<br/>crawlStatus=failed,<br/>reason=exceeded SQS maxReceiveCount,<br/>receiveCount=N]:::system
    DH_RLI --> Mark
    DH_RCE --> Mark
    Articles[(DynamoDB articles<br/>crawlStatus=failed)]:::store
    Mark --> Articles

    %% Common terminal event — same as user-save chain DLQs
    CAFE[CrawlArticleFailedEvent<br/>url, reason, receiveCount<br/>source=hutch.save-link]:::event
    DH_RLI -.publish.-> CAFE
    DH_RCE -.publish.-> CAFE
    Bus{{EventBridge default-bus}}:::system
    CAFE --> Bus

    %% Operator alarms
    Alarm[(CloudWatch alarm<br/>DLQ depth ≥ 1)]:::policy
    SNS[(SNS to alertEmail)]:::store
    DLQ_RLI -. metric .-> Alarm
    DLQ_RCE -. metric .-> Alarm
    Alarm --> SNS

    %% Reader fallout
    Reader[Reader UI<br/>buildUnifiedProgress returns undefined<br/>reader-slot renders failed-banner<br/>summary-slot collapses]:::policy
    Articles -. poll .-> Reader

    %% Summary-row failure mark on crawl-DLQ — added for the no-stuck-pending invariant
    SumMark[markSummaryFailed<br/>by HutchDLQEventHandler<br/>so summary slot doesn't sit on pending forever<br/>fixed in PR 207]:::system
    DH_RLI -.also.-> SumMark
    DH_RCE -.also.-> SumMark
    Sum[(DynamoDB summary attrs<br/>status=failed)]:::store
    SumMark --> Sum

    SGFE[SummaryGenerationFailedEvent<br/>parse-error log feed]:::event
    SumMark -.publish.-> SGFE
    SGFE --> Bus
```

</details>

---

## Command → System → Event(s) reference

| Command / Event | Handler / system | Emits / writes | Triggers next |
|---|---|---|---|
| `GET /admin/recrawl/<url>` (HTTP) | Express `handleRecrawlArticle` (`projects/hutch`) | `forceMarkCrawlPending` + `forceMarkSummaryPending` (DynamoDB), publishes `RecrawlLinkInitiatedEvent` | `recrawl-link-initiated` Lambda |
| `RecrawlLinkInitiatedEvent` | `recrawl-link-initiated` Lambda | Re-runs `saveLinkWork` (HTTP/2 fetch + Readability + media rewrite); writes `sources/tier-1.html` + sidecar; `markCrawlReady`; `updateFetchTimestamp` | publishes `RecrawlContentExtractedEvent` |
| `RecrawlContentExtractedEvent` | `recrawl-content-extracted` Lambda | `listAvailableTierSources`; runs Deepseek selector if competition, short-circuits on a single tier; `promoteTierToCanonical` (S3 CopyObject + Dynamo SET `contentSourceTier`); **always** dispatches `GenerateSummaryCommand` | `generate-summary` Lambda; publishes `RecrawlCompletedEvent` |
| `RecrawlCompletedEvent` | (no subscribers at this commit) | Used as a hook for future operator notifications | — |
| `GET /view/<url>` (HTTP) | Express `handleViewArticle` (`projects/hutch`) | `refreshArticleIfStale` decides; `new`/`reprime` writes stub + `markCrawlPending` + `markSummaryPending` and publishes `SaveAnonymousLinkCommand` | `save-anonymous-link-command` Lambda (see `bfd85c7` snapshot) |
| `refreshArticleIfStale` action `refreshed` | Same in-process call | Publishes `RefreshArticleContentCommand` (in-place metadata update) | `refresh-article-content` Lambda |
| `refreshArticleIfStale` action `unchanged` | Same in-process call | Publishes `UpdateFetchTimestampCommand` | `update-fetch-timestamp` Lambda |
| `resolveReaderState` (per request) | `article-reader` core | Legacy-stub heal: `markCrawlPending` + `markSummaryPending` when both undefined; computes `readerPollUrl`, `summaryPollUrl`, unified `ProgressTick` | Reader/summary HTMX polls (`/view/reader`, `/view/summary`, admin equivalents) |
| `handleReaderPoll` / `handleSummaryPoll` | `article-reader` core | Re-reads crawl + summary + content; emits OOB progress-bar fragment via `renderProgressBarOob`; bounds polling at `MAX_POLLS=40` | Continues HTMX swap loop or terminates |
| `GenerateSummaryCommand` | `generate-summary` Lambda | Single Deepseek `json_schema` call returns `{summary, excerpt}`; `saveGeneratedSummary` writes both atomically; emits `SummaryGeneratedEvent` on success | `summary-generated` Lambda (see `52017f3` snapshot) |
| `recrawl-link-initiated-dlq` | `HutchDLQEventHandler` | `markCrawlFailed`; publishes `CrawlArticleFailedEvent`; CloudWatch alarm pages `alertEmail` | (terminal) |
| `recrawl-content-extracted-dlq` | `HutchDLQEventHandler` | `markCrawlFailed`; publishes `CrawlArticleFailedEvent`; CloudWatch alarm pages `alertEmail` | (terminal) |

---

## Why the recrawl event chain is separate from `SaveAnonymousLinkCommand`

The previous snapshot's note that admin recrawl reused `SaveAnonymousLinkCommand` is no longer true; the user-save selector gates `LinkSaved` / `AnonymousLinkSaved` on canonical change to keep the summary pipeline idempotent on losses (a re-save of the same URL whose tier didn't change must not regenerate the summary, since the user-facing semantics of "save" is dedup-friendly). For admin recrawl the operator-facing semantics is the opposite: the human pressed the button **because** they want a fresh AI excerpt regardless of whether the source bytes changed. Splitting the event chain keeps both invariants enforceable in the handler code (`select-most-complete-content-handler` checks `currentTier !== winnerTier`; `recrawl-content-extracted-handler` skips the check) without conditional branching that would couple the two semantics together.

The view-side auto-heal (`reprime` action) is not affected by this split — it represents an **anonymous viewer arriving at a previously-failed save**, which from a user-save semantics standpoint is the same as a fresh save (we want to retry, and we want the summary to land if it didn't before). It correctly stays on the `SaveAnonymousLinkCommand` chain.
