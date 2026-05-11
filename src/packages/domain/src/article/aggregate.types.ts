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

export interface Article {
	url: string;
	crawl: CrawlState;
	summary: SummaryState;
	metadata: ArticleMetadata;
	estimatedReadTime: Minutes;
	contentFetchedAt?: string;
	etag?: string;
	lastModified?: string;
}
