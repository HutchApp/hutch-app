interface ParsedArticle {
	title: string;
	siteName: string;
	excerpt: string;
	wordCount: number;
	content: string;
	imageUrl?: string;
}

export type ParseArticleResult =
	| { ok: true; article: ParsedArticle }
	| { ok: false; reason: string };

export type ParseArticle = (url: string) => Promise<ParseArticleResult>;

export type CrawlArticleResult =
	| { status: "fetched"; html: string; etag?: string; lastModified?: string }
	| { status: "not-modified" }
	| { status: "failed" };

export type CrawlArticle = (params: {
	url: string;
	etag?: string;
	lastModified?: string;
}) => Promise<CrawlArticleResult>;
