import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import type { FetchHtml } from "./providers/article-parser/readability-parser";
import { createHutchApp } from "./app";

const stubFetchHtml: FetchHtml = async (url) => {
	const hostname = new URL(url).hostname;
	return `<html><head><title>Article from ${hostname}</title></head><body><article><p>Content saved from ${hostname}.</p></article></body></html>`;
};

export function createTestApp(options?: {
	livereloadMiddleware?: NonNullable<Parameters<typeof createHutchApp>[0]>["livereloadMiddleware"];
	parseArticle?: NonNullable<Parameters<typeof createHutchApp>[0]>["parseArticle"];
}) {
	return createHutchApp({
		parseArticle: options?.parseArticle ?? initReadabilityParser({ fetchHtml: stubFetchHtml }).parseArticle,
		livereloadMiddleware: options?.livereloadMiddleware,
	});
}

export function createTestAppWithFetchHtml(fetchHtml: FetchHtml) {
	return createHutchApp({
		parseArticle: initReadabilityParser({ fetchHtml }).parseArticle,
	});
}
