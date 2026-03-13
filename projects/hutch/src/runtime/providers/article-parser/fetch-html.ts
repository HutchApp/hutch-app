import type { FetchHtml } from "./readability-parser";

const FETCH_TIMEOUT_MS = 5000;

export function initFetchHtml(deps: {
	fetch: typeof globalThis.fetch;
}): FetchHtml {
	return async (url) => {
		try {
			const response = await deps.fetch(url, {
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
				headers: { accept: "text/html" },
			});
			if (!response.ok) return undefined;
			const contentType = response.headers.get("content-type") ?? "";
			if (!contentType.includes("text/html")) return undefined;
			return await response.text();
		} catch {
			return undefined;
		}
	};
}
