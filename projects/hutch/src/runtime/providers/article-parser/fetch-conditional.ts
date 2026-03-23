import type { FetchConditional } from "./article-parser.types";
import { headerOrUndefined } from "./header-utils";

const FETCH_TIMEOUT_MS = 5000;

export function initFetchConditional(deps: {
	fetch: typeof globalThis.fetch;
}): FetchConditional {
	return async (params) => {
		try {
			const headers: Record<string, string> = { accept: "text/html" };
			if (params.etag) headers["if-none-match"] = params.etag;
			if (params.lastModified) headers["if-modified-since"] = params.lastModified;

			const response = await deps.fetch(params.url, {
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
				headers,
			});

			if (response.status === 304) {
				return { changed: false };
			}

			if (!response.ok) return { changed: false };

			const contentType = response.headers.get("content-type") ?? "";
			if (!contentType.includes("text/html")) return { changed: false };

			const html = await response.text();
			return {
				changed: true,
				html,
				etag: headerOrUndefined(response.headers, "etag"),
				lastModified: headerOrUndefined(response.headers, "last-modified"),
			};
		} catch {
			return { changed: false };
		}
	};
}
