import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import type { FetchHtml } from "./providers/article-parser/readability-parser";
import { createHutchApp } from "./app";

const stubFetchHtml: FetchHtml = async (url) => {
	const hostname = new URL(url).hostname;
	return `<html><head><title>Article from ${hostname}</title></head><body><article><p>Content saved from ${hostname}.</p></article></body></html>`;
};

export function createTestApp() {
	return createHutchApp({
		parseArticle: initReadabilityParser({ fetchHtml: stubFetchHtml }).parseArticle,
	});
}

export function createTestAppWithFetchHtml(fetchHtml: FetchHtml) {
	return createHutchApp({
		parseArticle: initReadabilityParser({ fetchHtml }).parseArticle,
	});
}
