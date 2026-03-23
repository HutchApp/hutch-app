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

export type ParseHtml = (params: { url: string; html: string }) => ParseArticleResult;

export interface FetchHtmlResult {
	html: string;
	etag?: string;
	lastModified?: string;
}

export type FetchHtmlWithHeaders = (url: string) => Promise<FetchHtmlResult | undefined>;

export type ConditionalFetchResult =
	| { changed: false }
	| { changed: true; html: string; etag?: string; lastModified?: string };

export type FetchConditional = (params: {
	url: string;
	etag?: string;
	lastModified?: string;
}) => Promise<ConditionalFetchResult>;
