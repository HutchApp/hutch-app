import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import type { FetchHtml } from "./providers/article-parser/readability-parser";
import { createApp } from "./server";

const stubFetchHtml: FetchHtml = async (url) => {
	const hostname = new URL(url).hostname;
	return `<html><head><title>Article from ${hostname}</title></head><body><article><p>Content saved from ${hostname}.</p></article></body></html>`;
};

export function createTestApp() {
	const auth = initInMemoryAuth();
	const articleStore = initInMemoryArticleStore();
	const parser = initReadabilityParser({ fetchHtml: stubFetchHtml });

	const app = createApp({
		...auth,
		...articleStore,
		...parser,
	});

	return { app, auth, articleStore, parser };
}

export function createTestAppWithFetchHtml(fetchHtml: FetchHtml) {
	const auth = initInMemoryAuth();
	const articleStore = initInMemoryArticleStore();
	const parser = initReadabilityParser({ fetchHtml });

	const app = createApp({
		...auth,
		...articleStore,
		...parser,
	});

	return { app, auth, articleStore, parser };
}
