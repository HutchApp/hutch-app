# Save-Link-Raw Flow — Event Storming

**Commit:** `bfd85c7` &nbsp;•&nbsp; **Commit date:** 2026-04-24 &nbsp;•&nbsp; **Generated:** 2026-04-24 &nbsp;•&nbsp; **Branch:** `main`
**Subject:** `feat(save-link): Tier 0 canonical promotion via Deepseek selector + DLQ consumer`

A point-in-time map of the **extension-originated** save path — when a logged-in user clicks *Save* in the Firefox or Chrome extension, the content script captures the **rendered DOM** of the active tab and the server stages it as a "Tier 0" source for that URL. Tier 0 then competes with whatever the HTTP crawler (Tier 1) produces for the same URL: a Deepseek JSON-mode selector picks the more complete body, and only the winner is promoted to the canonical `content.html`. If the SQS worker fails past `maxReceiveCount`, a dedicated DLQ consumer flips the article row to `crawlStatus=failed` and emits a `CrawlArticleFailed` event.

The broader article crawl pipeline (Tier 1 HTTP waterfall, Readability pre-parsers, anonymous `/view` and admin `/recrawl` entries, summary hand-off) is documented at [`../d5f38258/article-crawl-pipeline.md`](../d5f38258/article-crawl-pipeline.md). This snapshot zooms in on just the extension → raw-HTML → canonical-promotion → DLQ branch, which is net-new at this commit.

> Snapshots are historical. Any file path referenced below may have been renamed, moved, or deleted since this commit. Treat as an artefact, not a live guide.

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

## End-to-end flow — extension click to canonical write

From the moment the user clicks *Save* in the browser toolbar until the DynamoDB row carries a `contentLocation` pointing at the winning canonical HTML. The key design point: `POST /queue/save-html` publishes **two** commands in parallel — `SaveLinkRawHtmlCommand` (Tier 0, extension DOM) and the original `SaveLinkCommand` / `SaveAnonymousLinkCommand` chain (Tier 1, HTTP crawl). Whichever worker's output looks more complete wins the canonical slot.

![End-to-end flow](diagrams/end-to-end-flow.svg)

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

    %% Browser side
    Click([User clicks Save<br/>toolbar button / context menu]):::policy
    BG[Extension background<br/>captureActiveTabHtml]:::system
    Content[Content script<br/>capture-html message]:::system
    Click --> BG
    BG -->|tabs.sendMessage<br/>5s timeout| Content
    Content -->|rawHtml string| BG

    %% HTTP boundary
    Post([POST /queue/save-html<br/>Bearer token required<br/>body: url, rawHtml &le;10MB, title?]):::policy
    BG -->|fetch| Post

    %% Ingress handler
    Queue[queue.page.ts<br/>save-html route]:::system
    Post --> Queue

    %% Side effects written by ingress
    S3Pending[(S3 pending-html bucket<br/>key: hashId/pending.html)]:::store
    Articles1[(DynamoDB articles table<br/>stub row: crawlStatus=pending)]:::store
    Queue -->|putPendingHtml| S3Pending
    Queue -->|saveArticleFromUrl<br/>markCrawlPending| Articles1

    %% Two parallel commands
    SLRHC[SaveLinkRawHtmlCommand<br/>url, userId, title?]:::command
    SLC[SaveLinkCommand<br/>url, userId<br/>Tier 1 HTTP path]:::command
    Queue -.publish.-> SLRHC
    Queue -.publish.-> SLC

    %% Event bus -> SQS
    Bus{{EventBridge default-bus}}:::system
    SLRHC --> Bus
    SLC --> Bus

    Q0[(save-link-raw-html-command<br/>vis 60s, maxReceive 3)]:::queue
    Q1[(save-link-command<br/>vis 60s)]:::queue
    Bus --> Q0
    Bus --> Q1

    %% Tier 0 worker
    Worker0[Tier 0 worker<br/>save-link-raw-html-command-handler]:::system
    Q0 --> Worker0

    %% Tier 1 worker link
    Worker1[Tier 1 worker<br/>save-link-command-handler<br/>see d5f38258 snapshot]:::system
    Q1 --> Worker1

    %% Tier 0 writes source, reads canonical, runs selector
    S3Source[(S3 content bucket<br/>sources/tier-0.html)]:::store
    S3Canonical[(S3 content bucket<br/>content.html<br/>canonical slot)]:::store
    Articles2[(DynamoDB articles table<br/>title, wordCount, contentLocation)]:::store

    Worker0 -->|readPendingHtml| S3Pending
    Worker0 -->|parseHtml + downloadMedia<br/>posthtml URL rewrite| Worker0
    Worker0 -->|putSourceContent tier-0| S3Source
    Worker0 -->|readCanonicalContent| Articles2
    Worker0 -->|selectMostCompleteContent| DS[Deepseek chat<br/>JSON mode selector]:::system

    %% Promotion branch
    Decide{Canonical empty<br/>or tier-0 wins?}:::policy
    Worker0 --> Decide
    Decide -- yes --> Promote[promoteSourceToCanonical<br/>S3 CopyObject + Dynamo SET]:::system
    Decide -- no<br/>canonical wins or tie --> Keep[Keep existing canonical<br/>no writes, no event]:::policy
    Promote --> S3Canonical
    Promote --> Articles2

    %% Conditional event
    LS[LinkSaved<br/>url, userId]:::event
    Promote -.publish only when changed.-> LS
    LS --> Bus
    Bus --> QSum[(link-saved queue<br/>summary pipeline<br/>see 52017f3 snapshot)]:::queue
```

</details>

---

## Tier 0 worker internals — pending HTML to canonical decision

The `save-link-raw-html-command` SQS consumer runs this sequence for every message. The branch at the bottom — `readCanonicalContent → selector → promote vs keep` — is the core of the Tier 0 promotion policy introduced at this commit. Notice that `publishLinkSaved` is only called on the *promote* branch: re-drives of the same command, or losses to an already-written canonical, are silent no-ops that don't re-kick the summary pipeline.

![Tier 0 worker internals](diagrams/tier-0-worker.svg)

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

    Msg([SQS message<br/>SaveLinkRawHtmlCommand detail]):::command
    Q0[(save-link-raw-html-command<br/>vis 60s, maxReceive 3)]:::queue
    Q0 --> Msg

    Read[readPendingHtml url<br/>S3 GetObject]:::system
    S3Pending[(S3 pending-html bucket)]:::store
    Msg --> Read
    Read <--> S3Pending

    Parse[parseHtml url, html<br/>Readability + site pre-parsers]:::system
    Read --> Parse

    Media[downloadMedia<br/>rewrite media to CDN]:::system
    Parse --> Media

    WriteSrc[putSourceContent<br/>tier-0 html to S3]:::system
    S3Source[(S3 content bucket<br/>sources/tier-0.html)]:::store
    Media --> WriteSrc
    WriteSrc --> S3Source

    ReadCanon[readCanonicalContent url<br/>Dynamo projection + S3 if contentLocation set]:::system
    Dynamo[(DynamoDB articles<br/>title, wordCount, contentLocation)]:::store
    WriteSrc --> ReadCanon
    ReadCanon <--> Dynamo

    HasCanon{contentLocation<br/>already set?}:::policy
    ReadCanon --> HasCanon

    HasCanon -- no<br/>first write wins --> PromoteA[promoteSourceToCanonical tier-0]:::system

    HasCanon -- yes --> Selector[selectMostCompleteContent<br/>candidates = tier-0, canonical]:::system
    DS[Deepseek chat<br/>model: deepseek-chat<br/>response_format: json_object<br/>max 8192 tokens]:::system
    Selector <--> DS

    Winner{winner<br/>tier-0 vs canonical vs tie}:::policy
    Selector --> Winner
    Winner -- tier-0 --> PromoteB[promoteSourceToCanonical tier-0]:::system
    Winner -- canonical --> Noop[Keep canonical<br/>no writes]:::policy
    Winner -- tie --> Noop

    PromoteA --> CopyA[S3 CopyObject<br/>sources/tier-0.html to content.html]:::system
    PromoteB --> CopyB[S3 CopyObject<br/>sources/tier-0.html to content.html]:::system
    S3Canonical[(S3 content bucket<br/>content.html)]:::store
    CopyA --> S3Canonical
    CopyB --> S3Canonical

    UpdateRow[Dynamo UpdateItem<br/>SET title, wordCount, excerpt,<br/>siteName, estimatedReadTime,<br/>contentLocation, contentFetchedAt]:::system
    CopyA --> UpdateRow
    CopyB --> UpdateRow
    UpdateRow --> Dynamo

    LS[LinkSaved<br/>url, userId]:::event
    UpdateRow -.publish.-> LS
    Noop -.no event.-> End([Message deleted<br/>worker exits]):::policy

    Bus{{EventBridge default-bus}}:::system
    LS --> Bus
    Bus --> QLS[(link-saved queue)]:::queue
```

</details>

---

## Failure paths — retry, DLQ, crawl-failed

Readability parse throws and S3/Dynamo/Deepseek transient errors all propagate as thrown exceptions out of the worker. SQS retries the message up to `maxReceiveCount` (3 by default for `HutchSQSBackedLambda`); after that the message lands in the DLQ. The DLQ handler is a thin reaction that marks the article failed and publishes a `CrawlArticleFailed` event, mirroring the same shape the Tier 1 (`save-link-dlq`) handler uses — the UI layer consumes the event regardless of which tier produced the failure.

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

    Q0[(save-link-raw-html-command<br/>vis 60s, maxReceive 3)]:::queue
    Worker[Tier 0 worker<br/>throws on S3 GET,<br/>parse throw, Dynamo fail,<br/>Deepseek 5xx, etc.]:::system
    Q0 --> Worker

    Retry{ApproximateReceiveCount<br/>&lt; maxReceiveCount?}:::policy
    Worker -- throw --> Retry
    Retry -- yes --> Q0

    DLQ[(save-link-raw-html-dlq<br/>redrive target)]:::dlq
    Retry -- no --> DLQ

    DLQWorker[save-link-raw-html-dlq-handler<br/>thin reaction]:::system
    DLQ --> DLQWorker

    Mark[markCrawlFailed<br/>reason: exceeded SQS maxReceiveCount]:::system
    Dynamo[(DynamoDB articles<br/>crawlStatus = failed)]:::store
    DLQWorker --> Mark
    Mark --> Dynamo

    Evt[CrawlArticleFailed<br/>url, reason, receiveCount]:::event
    DLQWorker -.publish.-> Evt

    Bus{{EventBridge default-bus}}:::system
    Alarm[(SNS email alarm<br/>DLQ depth &gt; 0)]:::policy
    Evt --> Bus
    DLQ -.CloudWatch metric.-> Alarm
```

</details>

---

## Command → System → Event(s) reference table

Every command in this flow, the system that handles it, the events it publishes, and the policy that turns each event into the next command. Read top-down to follow a single save.

| Command | Handled by | Reads / writes | Event(s) emitted | Triggers command(s) |
|---|---|---|---|---|
| `POST /queue/save-html` (HTTP, Bearer auth) | `queue.page.ts` save-html route | write: S3 pending-html bucket (pending.html), Dynamo articles (stub, crawlStatus=pending) | — (publishes two commands directly, no event) | `SaveLinkRawHtmlCommand`, `SaveLinkCommand` (Tier 1, parallel) |
| `SaveLinkRawHtmlCommand { url, userId, title? }` | Tier 0 SQS worker `save-link-raw-html-command-handler` | read: S3 pending-html, Dynamo articles; write: S3 sources/tier-0.html; conditional write: S3 content.html + Dynamo articles (SET contentLocation, title, wordCount, etc.); external call: Deepseek `deepseek-chat` JSON mode | `LinkSaved { url, userId }` **only when canonical changed** | `GenerateSummaryCommand` (via link-saved worker, summary pipeline) |
| `SaveLinkCommand { url, userId }` (Tier 1) | See [`../d5f38258/article-crawl-pipeline.md`](../d5f38258/article-crawl-pipeline.md) | HTTP crawl waterfall, Readability, markCrawlReady/Failed | `LinkSaved` | `GenerateSummaryCommand` |
| *(reaction, no command)* — Deepseek selector loss or tie | Same Tier 0 worker branch | read-only; decides to skip promotion | — | — (message deleted, summary pipeline not re-kicked) |
| *(reaction, no command)* — `maxReceiveCount` exceeded on raw-html queue | DLQ consumer `save-link-raw-html-dlq-handler` | write: Dynamo articles (SET crawlStatus=failed, reason) | `CrawlArticleFailed { url, reason, receiveCount }` | — (UI reads event for failure banner + retry affordance; SNS alarm fires on DLQ depth) |

---

## Notes on scope

- **Authenticated only.** `POST /queue/save-html` requires a Bearer token; there is no anonymous variant of the raw-HTML path. Anonymous saves (`SaveAnonymousLinkCommand`) still go through the Tier 1 HTTP waterfall.
- **Both tiers run in parallel.** The ingress route publishes `SaveLinkRawHtmlCommand` *and* the Tier 1 `SaveLinkCommand` for the same URL. Neither worker waits for the other; the Deepseek selector is the tiebreaker, and whichever worker finishes second sees a non-empty canonical and runs the contest.
- **LinkSaved is idempotent on "no change".** The summary pipeline is downstream of `LinkSaved`, so the conditional publish in the Tier 0 worker prevents redundant summary regenerations when Tier 0 loses the contest.
- **DLQ alarm is load-bearing.** The existing SNS email alarm on DLQ depth is the signal a real user's save got wedged past retries. The DLQ handler marking `crawlStatus=failed` is what unblocks the UI, not what notifies the operator.
