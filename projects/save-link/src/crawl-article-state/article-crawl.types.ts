export type MarkCrawlReady = (params: { url: string }) => Promise<void>;
export type MarkCrawlFailed = (params: {
	url: string;
	reason: string;
}) => Promise<void>;
