import type { FindCachedSummary, SaveCachedSummary } from "./article-summary.types";

export function initInMemorySummaryCache(): {
	findCachedSummary: FindCachedSummary;
	saveCachedSummary: SaveCachedSummary;
} {
	const cache = new Map<string, string>();

	const findCachedSummary: FindCachedSummary = async (url) => {
		return cache.get(url) ?? null;
	};

	const saveCachedSummary: SaveCachedSummary = async (params) => {
		cache.set(params.url, params.summary);
	};

	return { findCachedSummary, saveCachedSummary };
}
