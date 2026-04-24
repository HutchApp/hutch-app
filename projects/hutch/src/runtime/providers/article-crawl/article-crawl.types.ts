export type ArticleCrawl =
	| { status: "pending" }
	| { status: "ready" }
	| { status: "failed"; reason: string };

export type FindArticleCrawlStatus = (
	url: string,
) => Promise<ArticleCrawl | undefined>;

export type MarkCrawlPending = (params: { url: string }) => Promise<void>;

/**
 * Unconditionally moves a row to crawlStatus=pending, even if it is currently
 * `ready`. Used only by the operator recrawl endpoint where we explicitly want
 * to discard the previous terminal state so the reader slot shows
 * "recrawl in progress" while the worker re-runs. Clears any prior
 * crawlFailureReason.
 */
export type ForceMarkCrawlPending = (params: { url: string }) => Promise<void>;
