export type ArticleCrawl =
	| { status: "pending" }
	| { status: "ready" }
	| { status: "failed"; reason: string };

export type FindArticleCrawlStatus = (
	url: string,
) => Promise<ArticleCrawl | undefined>;

export type MarkCrawlPending = (params: { url: string }) => Promise<void>;
