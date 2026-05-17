export type ThumbnailImage = {
	body: Buffer;
	contentType: string;
	url: string;
	extension: string;
};

export type CrawlArticleResult =
	| {
			status: "fetched";
			html: string;
			thumbnailUrl?: string;
			thumbnailImage?: ThumbnailImage;
			etag?: string;
			lastModified?: string;
	  }
	| { status: "not-modified" }
	| { status: "failed" }
	| { status: "unsupported"; reason: string };

export type CrawlArticle = (params: {
	url: string;
	etag?: string;
	lastModified?: string;
	fetchThumbnail?: boolean;
}) => Promise<CrawlArticleResult>;

/**
 * Same signature as `CrawlArticle`. The alias exists so call sites that need to
 * distinguish the two halves of the split can name the parameter — the simple
 * factory handles HTML + oembed, and surfaces an `unsupported` result with a
 * `PDF_DETECTED_REASON` reason when it sniffs PDF magic bytes so the caller can
 * decide whether to fall through to the comprehensive factory.
 */
export type SimpleCrawl = CrawlArticle;

/**
 * The comprehensive factory handles PDF extraction — the expensive path that
 * can hold a Lambda concurrency slot for tens of seconds while pdfjs walks
 * every page. Accepts an optional `onPdfPage` callback the orchestrator uses
 * to record per-page progress against the unified bar; the callback is
 * synchronous-fire-and-forget from the crawler's perspective and any errors
 * it surfaces are swallowed by the crawler.
 */
export type ComprehensiveCrawl = (params: {
	url: string;
	etag?: string;
	lastModified?: string;
	fetchThumbnail?: boolean;
	onPdfPage?: (params: { pageIndex: number; pageCount: number }) => void;
}) => Promise<CrawlArticleResult>;

/**
 * Sentinel reason the simple factory returns when its magic-byte sniff or
 * Content-Type check identifies a PDF. The save-link orchestrator pattern-matches
 * this exact prefix to decide whether to invoke the comprehensive factory.
 */
export const PDF_DETECTED_REASON = "pdf-detected" as const;
