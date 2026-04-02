import type { FetchHtmlWithHeaders } from "./article-parser.types";
import type { FetchHtml } from "./readability-parser";
import { headerOrUndefined } from "./header-utils";

const FETCH_TIMEOUT_MS = 5000;

export function initFetchHtmlWithHeaders(deps: {
	fetch: typeof globalThis.fetch;
	logError: (message: string, error?: Error) => void;
}): FetchHtmlWithHeaders {
	return async (url) => {
		try {
			const response = await deps.fetch(url, {
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
				headers: { accept: "text/html" },
			});
			if (!response.ok) {
				deps.logError(`[FetchArticle] HTTP ${response.status} for ${url}`);
				return undefined;
			}
			const contentType = response.headers.get("content-type") ?? "";
			if (!contentType.includes("text/html")) {
				deps.logError(`[FetchArticle] Unexpected Content-Type "${contentType}" for ${url}`);
				return undefined;
			}
			const html = await response.text();
			return {
				html,
				etag: headerOrUndefined(response.headers, "etag"),
				lastModified: headerOrUndefined(response.headers, "last-modified"),
			};
		} catch (error) {
			deps.logError(`[FetchArticle] Network error for ${url}`, error instanceof Error ? error : undefined);
			return undefined;
		}
	};
}

export function initFetchHtml(deps: {
	fetch: typeof globalThis.fetch;
	logError: (message: string, error?: Error) => void;
}): FetchHtml {
	const fetchWithHeaders = initFetchHtmlWithHeaders(deps);
	return async (url) => {
		const result = await fetchWithHeaders(url);
		return result?.html;
	};
}
