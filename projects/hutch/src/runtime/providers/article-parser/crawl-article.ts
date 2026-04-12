import type { CrawlArticle } from "./article-parser.types";
import { headerOrUndefined } from "./header-utils";

const FETCH_TIMEOUT_MS = 5000;

/**
 * Browser-like headers required by Fastly/Cloudflare edge sniffers.
 * Medium returns 403 without both User-Agent AND Accept-Language.
 */
export const DEFAULT_CRAWL_HEADERS = {
	"user-agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
	accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
	"accept-language": "en-US,en;q=0.9",
} as const;

export function initCrawlArticle(deps: {
	fetch: typeof globalThis.fetch;
	logError: (message: string, error?: Error) => void;
	headers: Record<string, string>;
}): CrawlArticle {
	return async (params) => {
		const headers: Record<string, string> = { ...deps.headers };
		if (params.etag) headers["if-none-match"] = params.etag;
		if (params.lastModified) headers["if-modified-since"] = params.lastModified;

		try {
			const response = await deps.fetch(params.url, {
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
				headers,
			});
			if (response.status === 304) {
				return { status: "not-modified" };
			}
			if (!response.ok) {
				deps.logError(`[CrawlArticle] HTTP ${response.status} for ${params.url}`);
				return { status: "failed" };
			}
			const contentType = response.headers.get("content-type") ?? "";
			if (!contentType.includes("text/html")) {
				deps.logError(`[CrawlArticle] Unexpected Content-Type "${contentType}" for ${params.url}`);
				return { status: "failed" };
			}
			const html = await response.text();
			return {
				status: "fetched",
				html,
				etag: headerOrUndefined(response.headers, "etag"),
				lastModified: headerOrUndefined(response.headers, "last-modified"),
			};
		} catch (error) {
			deps.logError(`[CrawlArticle] Network error for ${params.url}`, error instanceof Error ? error : undefined);
			return { status: "failed" };
		}
	};
}
