export type MarkCrawlReady = (params: { url: string }) => Promise<void>;
export type MarkCrawlFailed = (params: {
	url: string;
	reason: string;
}) => Promise<void>;

/**
 * Worker-side stage strings for the crawl progress bar. Kept as a literal
 * union here (and mirrored in the hutch-side progress-mapping module) so the
 * save-link package does not take a cross-project relative import on the
 * percentage table — the worker only needs to write the stage name; the
 * reader maps stage → pct at render time.
 */
export type CrawlStage =
	| "crawl-fetching"
	| "crawl-fetched"
	| "crawl-parsed"
	| "crawl-metadata-written"
	| "crawl-content-uploaded"
	| "crawl-ready";

export type MarkCrawlStage = (params: {
	url: string;
	stage: CrawlStage;
}) => Promise<void>;
