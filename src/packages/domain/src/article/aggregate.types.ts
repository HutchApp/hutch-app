import type { ArticleMetadata, Minutes } from "./article.types";
import type { CrawlStage, SummaryStage } from "./progress-mapping";

// `stage` is optional because the row goes through several stage ticks during
// a single pending lifetime; consumers that don't care about the stage keep
// working without it.
export type CrawlState =
	| { status: "pending"; stage?: CrawlStage }
	| { status: "ready" }
	| { status: "failed"; reason: string; failedAt: string }
	| { status: "unsupported"; reason: string; failedAt: string };

// `skipped` reason is optional because the legacy/in-memory store historically
// allowed a bare skipped row without a reason; the writer contract is "set the
// reason when you know why", not "always have one".
export type SummaryState =
	| { status: "pending"; stage?: SummaryStage }
	| {
			status: "ready";
			summary: string;
			excerpt?: string;
			inputTokens: number;
			outputTokens: number;
		}
	| { status: "failed"; reason: string }
	| { status: "skipped"; reason?: string };

/**
 * 1. Held on the aggregate so the refresh transition can produce a fully
 *    consistent (metadata + summary reset) post-state in one operation
 *    instead of two parallel writes.
 * 2. Freshness fields ride along on the aggregate because the same refresh
 *    transition that resets the summary also stamps the new freshness
 *    headers; keeping them on the aggregate keeps the write atomic.
 */
export interface Article {
	url: string;
	version: number;
	crawl: CrawlState;
	summary: SummaryState;
	metadata: ArticleMetadata; /* 1 */
	estimatedReadTime: Minutes; /* 1 */
	contentFetchedAt?: string; /* 2 */
	etag?: string; /* 2 */
	lastModified?: string; /* 2 */
}
