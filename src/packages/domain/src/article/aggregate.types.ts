import type { ArticleMetadata, Minutes } from "./article.types";
import type { CrawlStage, SummaryStage } from "./progress-mapping";

/**
 * 1. `pending`, `ready`, `failed`, `unsupported` mirror the persisted
 *    `crawlStatus` enum from @packages/article-state-types. The aggregate
 *    pairs each kind with the payload the writer must carry atomically:
 *    `failed` MUST have a reason and timestamp, `ready` MUST NOT carry a
 *    reason. Making this a discriminated union is what closes the
 *    summaryStatus=ready/summary=undefined class of bugs at compile time.
 * 2. The `pending` stage attribute is optional because the row goes through
 *    several stage ticks during a single pending lifetime; consumers that
 *    don't care about the stage (canary, terminal-state assertions) keep
 *    working without it.
 */
export type CrawlState =
	| { status: "pending"; stage?: CrawlStage } /* 1, 2 */
	| { status: "ready" } /* 1 */
	| { status: "failed"; reason: string; failedAt: string } /* 1 */
	| { status: "unsupported"; reason: string; failedAt: string }; /* 1 */

/**
 * 1. Mirrors the persisted `summaryStatus` enum. `ready` carries the summary
 *    text plus excerpt + token counts so the writer cannot mark a row ready
 *    without producing all the fields the reader expects (the
 *    summaryStatus=ready/summary=undefined regression the assertion at
 *    dynamodb-generated-summary.ts:70 fails loud on today).
 * 2. `skipped` reason is optional because the legacy/in-memory store
 *    historically allowed a bare skipped row without a reason; the writer
 *    contract is "set the reason when you know why", not "always have one".
 */
export type SummaryState =
	| { status: "pending"; stage?: SummaryStage }
	| {
			status: "ready";
			summary: string;
			excerpt?: string;
			inputTokens: number;
			outputTokens: number;
		} /* 1 */
	| { status: "failed"; reason: string }
	| { status: "skipped"; reason?: string }; /* 2 */

/**
 * 1. URL is the row identity; persisted as the partition key.
 * 2. `version` is the row-level CAS attribute. A first-time aggregate write
 *    sets `version: 1`; subsequent writes do
 *    `ConditionExpression: version = :expected` with the value the writer
 *    loaded. Pre-aggregate rows have no `version` attribute on read — the
 *    storage adapter projects those as `version: 0` and the first save
 *    conditions on `attribute_not_exists(version)`.
 * 3. Article-wide metadata fields the refresh-article-content path writes.
 *    Held on the aggregate so the refresh transition can produce a fully
 *    consistent (metadata + summary reset) post-state in one operation
 *    instead of two parallel writes.
 * 4. Freshness fields ride along on the aggregate because the same refresh
 *    transition that resets the summary also stamps the new freshness
 *    headers; keeping them on the aggregate keeps the write atomic.
 */
export interface Article {
	url: string; /* 1 */
	version: number; /* 2 */
	crawl: CrawlState;
	summary: SummaryState;
	metadata: ArticleMetadata; /* 3 */
	estimatedReadTime: Minutes; /* 3 */
	contentFetchedAt?: string; /* 4 */
	etag?: string; /* 4 */
	lastModified?: string; /* 4 */
}
