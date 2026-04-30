# Save-Link Event Storming

End-to-end map of what happens after the user submits a URL from the UI.
Convention: **Command (blue)** → **System (yellow)** → **Event (orange)** → next Command(s).
Read models / writes shown in green. SQS / DLQ topology shown grey.

Diagrams are pre-rendered as SVGs in `diagrams/` so they display in any Markdown viewer (MacDown, GitHub, browsers, Quicklook) without a Mermaid plugin. The original Mermaid source is kept below each image so the diagram can be re-rendered with `npx -p @mermaid-js/mermaid-cli mmdc -i SAVE_LINK_EVENT_STORMING.md -o diagrams/save-link.svg`.

---

## Legend

![Legend](diagrams/legend.svg)

<details><summary>Mermaid source</summary>

```mermaid
flowchart LR
    C[Command]:::cmd --> S[System / Aggregate]:::sys --> E[Event]:::evt --> P((Policy)):::pol
    S --> R[(Read Model / Store)]:::read

    classDef cmd fill:#a6d8ff,stroke:#1e6fb8,color:#000
    classDef sys fill:#fff2a8,stroke:#a08a00,color:#000
    classDef evt fill:#ffb976,stroke:#a85800,color:#000
    classDef pol fill:#d6b8ff,stroke:#6b3fb0,color:#000
    classDef read fill:#b8e8c5,stroke:#2f7a45,color:#000
```

</details>

---

## End-to-End Flow (authenticated `/queue` save)

![End-to-end flow](diagrams/end-to-end-flow.svg)

<details><summary>Mermaid source</summary>

```mermaid
flowchart TD
    %% ============= ENTRY =============
    UI[/"User clicks Save in UI<br/>(queue page or browser extension)"/]:::ui

    UI -->|"POST /queue (Siren)<br/>POST /queue/save (form)"| C0[SaveArticle]:::cmd

    %% ============= SYSTEM 1: HUTCH WEB LAMBDA (sync) =============
    C0 --> S1{{"Hutch Express App<br/>(Lambda + API Gateway)<br/>queue.page.ts"}}:::sys

    S1 -->|"refreshArticleIfStale()"| FRESH{{"Freshness Check<br/>check-content-freshness.ts"}}:::sys
    FRESH --> R0[("DynamoDB<br/>articles table<br/>GetItem etag/lastModified")]:::read
    FRESH -->|"HTTP GET (conditional)"| ORIG[("Origin website")]:::read

    %% Branches from freshness
    FRESH -->|"action: new"| S1P[parseArticle inline metadata]:::sys
    FRESH -->|"action: refreshed (HTTP 200, parsed)"| EVF1[ArticleContentRefreshed]:::evt
    FRESH -->|"action: unchanged (HTTP 304)"| EVF2[ArticleContentUnchanged]:::evt
    FRESH -->|"action: skip"| SKIP((noop)):::pol

    EVF1 -->|"publishRefreshArticleContent"| C_REFRESH[RefreshArticleContentCommand]:::cmd
    EVF2 -->|"publishUpdateFetchTimestamp"| C_TS1[UpdateFetchTimestampCommand]:::cmd

    %% Sync write of metadata
    S1P --> S1WRITE{{"saveArticle()"}}:::sys
    S1WRITE --> R1[("DynamoDB<br/>articles table<br/>UpdateItem (metadata)")]:::read
    S1WRITE --> EV0[ArticleMetadataSaved<br/>in-process]:::evt

    EV0 -->|"publishUpdateFetchTimestamp"| C_TS2[UpdateFetchTimestampCommand]:::cmd
    EV0 -->|"publishLinkSaved<br/>(see eventbridge-link-saved.ts)"| C1[SaveLinkCommand]:::cmd

    S1WRITE -->|"HTTP 201 Siren / 303 redirect"| UI

    %% ============= EVENTBRIDGE BUS =============
    C1 --> EB{{"EventBridge<br/>hutch event bus"}}:::sys
    C_REFRESH --> EB
    C_TS1 --> EB
    C_TS2 --> EB

    %% ============= SYSTEM 2: SAVE-LINK-COMMAND LAMBDA =============
    EB -->|"rule: source=hutch.api<br/>detail-type=SaveLinkCommand"| Q1[/"SQS save-link-command<br/>visibility 60s"/]:::queue
    Q1 -. on failure .-> DLQ1[/"DLQ → SNS → email"/]:::dlq
    Q1 -->|"EventSourceMapping<br/>batchSize=1"| S2{{"Lambda: save-link-command<br/>save-link-command-handler.ts"}}:::sys

    S2 -->|"crawlArticle"| ORIG2[("Origin website<br/>full HTML + thumbnail")]:::read
    S2 -->|"parseHtml (Readability)"| S2P[parseHtml]:::sys
    S2 -->|"downloadMedia"| MED[("Image origins")]:::read
    S2 -->|"putImageObject"| R2I[("S3 content bucket<br/>images/<hash>.ext")]:::read
    S2 -->|"processContent (rewrite img URLs to CDN)"| S2C[processContent]:::sys
    S2 -->|"putObject"| R2H[("S3 content bucket<br/>articles/<id>/content.html")]:::read
    S2 -->|"updateContentLocation"| R2D[("DynamoDB<br/>UpdateItem (contentLocation)")]:::read
    S2 -->|"updateThumbnailUrl"| R2T[("DynamoDB<br/>UpdateItem (thumbnailUrl)")]:::read

    S2 --> E1[LinkSavedEvent<br/>source=hutch.save-link]:::evt
    E1 -->|"publishEvent"| EB

    %% ============= SYSTEM 3: LINK-SAVED LAMBDA =============
    EB -->|"rule: detail-type=LinkSaved"| Q2[/"SQS link-saved<br/>visibility 60s"/]:::queue
    Q2 -. on failure .-> DLQ2[/"DLQ → SNS → email"/]:::dlq
    Q2 --> S3{{"Lambda: link-saved<br/>link-saved-handler.ts"}}:::sys

    S3 -->|"findArticleContent"| R3[("DynamoDB GetItem<br/>+ S3 GetObject")]:::read
    S3 -->|"dispatchGenerateSummary<br/>(direct SQS, NOT EventBridge)"| C2[GenerateSummaryCommand]:::cmd

    %% ============= SYSTEM 4: GENERATE-SUMMARY LAMBDA =============
    C2 --> Q3[/"SQS generate-summary<br/>visibility 300s"/]:::queue
    Q3 -. on failure .-> DLQ3[/"DLQ → SNS → email"/]:::dlq
    Q3 --> S4{{"Lambda: generate-summary<br/>generate-summary-handler.ts"}}:::sys

    S4 -->|"findArticleContent"| R4[("DynamoDB + S3")]:::read
    S4 -->|"summarizeArticle"| DS[("Deepseek API")]:::read
    S4 -->|"cache summary"| R4C[("DynamoDB<br/>UpdateItem (summary)")]:::read
    S4 --> E2[SummaryGeneratedEvent<br/>detail-type=GlobalSummaryGenerated]:::evt
    E2 -->|"publishEvent"| EB

    %% ============= SYSTEM 5: SUMMARY-GENERATED LAMBDA =============
    EB -->|"rule: detail-type=GlobalSummaryGenerated"| Q4[/"SQS summary-generated<br/>visibility 60s"/]:::queue
    Q4 -. on failure .-> DLQ4[/"DLQ → SNS → email"/]:::dlq
    Q4 --> S5{{"Lambda: summary-generated<br/>summary-generated-handler.ts"}}:::sys
    S5 -->|"logger.info (terminal)"| END((done)):::pol

    %% ============= PARALLEL: REFRESH CONTENT =============
    EB -->|"rule: detail-type=RefreshArticleContentCommand"| Q5[/"SQS refresh-article-content<br/>visibility 60s"/]:::queue
    Q5 -. on failure .-> DLQ5[/"DLQ → SNS → email"/]:::dlq
    Q5 --> S6{{"Lambda: refresh-article-content<br/>refresh-article-content-handler.ts"}}:::sys
    S6 -->|"refreshArticleContent"| R6[("DynamoDB UpdateItem<br/>metadata + etag + lastModified<br/>+ contentFetchedAt")]:::read
    S6 --> END2((done)):::pol

    %% ============= PARALLEL: UPDATE FETCH TIMESTAMP =============
    EB -->|"rule: detail-type=UpdateFetchTimestampCommand"| Q6[/"SQS update-fetch-timestamp<br/>visibility 60s"/]:::queue
    Q6 -. on failure .-> DLQ6[/"DLQ → SNS → email"/]:::dlq
    Q6 --> S7{{"Lambda: update-fetch-timestamp<br/>update-fetch-timestamp-handler.ts"}}:::sys
    S7 -->|"updateFetchTimestamp"| R7[("DynamoDB UpdateItem<br/>contentFetchedAt")]:::read
    S7 --> END3((done)):::pol

    %% ============= STYLES =============
    classDef ui fill:#fff,stroke:#000,stroke-width:2px,color:#000
    classDef cmd fill:#a6d8ff,stroke:#1e6fb8,color:#000
    classDef sys fill:#fff2a8,stroke:#a08a00,color:#000
    classDef evt fill:#ffb976,stroke:#a85800,color:#000
    classDef pol fill:#d6b8ff,stroke:#6b3fb0,color:#000
    classDef read fill:#b8e8c5,stroke:#2f7a45,color:#000
    classDef queue fill:#e8e8e8,stroke:#666,color:#000
    classDef dlq fill:#f8c8c8,stroke:#a83434,color:#000
```

</details>

---

## Anonymous variant (`/view/:id` save by anonymous visitor)

Reuses the same backend summary path; differs only in the entry command and the dedicated worker queue.

![Anonymous variant](diagrams/anonymous-variant.svg)

<details><summary>Mermaid source</summary>

```mermaid
flowchart TD
    UI2[/"Anonymous user views shared link<br/>view.page.ts"/]:::ui

    UI2 -->|"GET /view/:id"| S0{{"Hutch Express App<br/>(Lambda)"}}:::sys
    S0 -->|"saveArticleGlobally + publishSaveAnonymousLink"| C0[SaveAnonymousLinkCommand]:::cmd

    C0 --> EB{{"EventBridge"}}:::sys
    EB --> Q1[/"SQS save-anonymous-link-command"/]:::queue
    Q1 --> S1{{"Lambda: save-anonymous-link-command<br/>save-anonymous-link-command-handler.ts"}}:::sys
    S1 -->|"crawl + parse + S3 + DynamoDB<br/>(initSaveLinkWork — same code path as authenticated)"| R1[("S3 + DynamoDB")]:::read
    S1 --> E1[AnonymousLinkSavedEvent]:::evt

    E1 --> EB
    EB --> Q2[/"SQS anonymous-link-saved"/]:::queue
    Q2 --> S2{{"Lambda: anonymous-link-saved<br/>anonymous-link-saved-handler.ts"}}:::sys
    S2 -->|"dispatchGenerateSummary (direct SQS)"| C1[GenerateSummaryCommand]:::cmd

    C1 --> Q3[/"SQS generate-summary<br/>(shared with authenticated flow)"/]:::queue
    Q3 --> S3{{"Lambda: generate-summary"}}:::sys
    S3 --> E2[SummaryGeneratedEvent]:::evt
    E2 --> EB

    classDef ui fill:#fff,stroke:#000,stroke-width:2px,color:#000
    classDef cmd fill:#a6d8ff,stroke:#1e6fb8,color:#000
    classDef sys fill:#fff2a8,stroke:#a08a00,color:#000
    classDef evt fill:#ffb976,stroke:#a85800,color:#000
    classDef read fill:#b8e8c5,stroke:#2f7a45,color:#000
    classDef queue fill:#e8e8e8,stroke:#666,color:#000
```

</details>

---

## Command → System → Event(s) Reference Table

| # | Command | System (handler) | Event(s) emitted | Triggers next command(s) |
|---|---|---|---|---|
| 1 | `SaveArticle` (HTTP `POST /queue`, `POST /queue/save`) | Hutch Express App on Lambda — `queue.page.ts:182` & `:211` | `ArticleMetadataSaved` (in-process; HTTP 201/303 returned) | `SaveLinkCommand`, `UpdateFetchTimestampCommand`, optionally `RefreshArticleContentCommand` |
| 2 | `RefreshArticleContentCommand` (EventBridge → SQS `refresh-article-content`) | `refresh-article-content.main.ts` Lambda | — (terminal; DynamoDB UpdateItem) | none |
| 3 | `UpdateFetchTimestampCommand` (EventBridge → SQS `update-fetch-timestamp`) | `update-fetch-timestamp.main.ts` Lambda | — (terminal; DynamoDB UpdateItem) | none |
| 4 | `SaveLinkCommand` (EventBridge → SQS `save-link-command`) | `save-link-command.main.ts` Lambda — `save-link-command-handler.ts` | `LinkSavedEvent` (after S3 + DynamoDB writes) | (via reaction) `GenerateSummaryCommand` |
| 5 | `LinkSavedEvent` reaction (EventBridge → SQS `link-saved`) | `link-saved.main.ts` Lambda — `link-saved-handler.ts` | — | `GenerateSummaryCommand` (dispatched directly to SQS, **not** via EventBridge) |
| 6 | `GenerateSummaryCommand` (direct SQS `generate-summary`) | `generate-summary.main.ts` Lambda — `generate-summary-handler.ts` | `SummaryGeneratedEvent` | none |
| 7 | `SummaryGeneratedEvent` reaction (EventBridge → SQS `summary-generated`) | `summary-generated.main.ts` Lambda | — (logger only) | none |
| A1 | `SaveAnonymousLinkCommand` (anonymous `/view` save) | `save-anonymous-link-command.main.ts` Lambda | `AnonymousLinkSavedEvent` | (via reaction) `GenerateSummaryCommand` |
| A2 | `AnonymousLinkSavedEvent` reaction (EventBridge → SQS `anonymous-link-saved`) | `anonymous-link-saved.main.ts` Lambda | — | `GenerateSummaryCommand` (joins shared queue) |

---

## Topology notes

- **Command vs. Event naming.** `SaveLinkCommand` and `SaveAnonymousLinkCommand` are intent (imperative). `LinkSavedEvent`, `AnonymousLinkSavedEvent`, `SummaryGeneratedEvent` are facts (past tense). Definitions live in `src/packages/hutch-infra-components/src/events.ts`.
- **Two transport patterns.** Most cross-Lambda hops go through **EventBridge → SQS** via `HutchEventBus.subscribe(...)` (`event-bus.ts:60`). The single exception is `GenerateSummaryCommand`, which both `link-saved` and `anonymous-link-saved` Lambdas dispatch **directly to the SQS queue** via `initSqsCommandDispatcher` — this is a one-to-one command dispatch, not a fan-out event.
- **Every SQS-backed Lambda has a DLQ + SNS email alarm** (`hutch-sqs-backed-lambda.ts:44-68`) — the alert email is shared (`alertEmail` config) and pages on any DLQ message visible for 5 min.
- **Visibility timeouts:** all SQS queues use `60s`, except `generate-summary` (`300s`) — the Deepseek call is the long pole and the Lambda timeout is `45s`, leaving headroom for SQS redelivery.
- **Synchronous side of the request.** Before the HTTP response returns, the Hutch Lambda already writes article metadata to DynamoDB (so the user sees the article in their queue immediately). The crawl, S3 upload, and summary all happen async on the worker chain.
- **Idempotency.** `saveLinkWork` (shared by authenticated + anonymous handlers) is idempotent on the URL — re-processing a `SaveLinkCommand` overwrites the same S3 key (derived from `ArticleResourceUniqueId`) and re-writes the same DynamoDB attributes. Summary generation short-circuits via the `DynamoDbSummaryCache`.
