export type CrawlArticleResult =
	| { status: "fetched"; html: string; etag?: string; lastModified?: string }
	| { status: "not-modified" }
	| { status: "failed" };

export type CrawlArticle = (params: {
	url: string;
	etag?: string;
	lastModified?: string;
}) => Promise<CrawlArticleResult>;
