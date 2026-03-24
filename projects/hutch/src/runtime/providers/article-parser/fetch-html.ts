import type { FetchHtmlWithHeaders } from "./article-parser.types";
import type { FetchHtml } from "./readability-parser";
import { headerOrUndefined } from "./header-utils";

const FETCH_TIMEOUT_MS = 5000;

export function initFetchHtmlWithHeaders(deps: {
	fetch: typeof globalThis.fetch;
}): FetchHtmlWithHeaders {
	return async (url) => {
		try {
			const response = await deps.fetch(url, {
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
				headers: { accept: "text/html" },
			});
			if (!response.ok) return undefined;
			const contentType = response.headers.get("content-type") ?? "";
			if (!contentType.includes("text/html")) return undefined;
			const html = await response.text();
			return {
				html,
				etag: headerOrUndefined(response.headers, "etag"),
				lastModified: headerOrUndefined(response.headers, "last-modified"),
			};
		} catch {
			return undefined;
		}
	};
}

export function initFetchHtml(deps: {
	fetch: typeof globalThis.fetch;
}): FetchHtml {
	const fetchWithHeaders = initFetchHtmlWithHeaders(deps);
	return async (url) => {
		const result = await fetchWithHeaders(url);
		return result?.html;
	};
}
