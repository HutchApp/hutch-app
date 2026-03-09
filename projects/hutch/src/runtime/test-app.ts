import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import type { FetchHtml } from "./providers/article-parser/readability-parser";
import {
	createOAuthModel,
	initInMemoryOAuthModel,
} from "./providers/oauth/oauth-model";
import { createValidateAccessToken } from "./providers/oauth/validate-access-token";
import { createApp } from "./server";

const stubFetchHtml: FetchHtml = async (url) => {
	const hostname = new URL(url).hostname;
	return `<html><head><title>Article from ${hostname}</title></head><body><article><p>Content saved from ${hostname}.</p></article></body></html>`;
};

export function createTestApp(options?: {
	livereloadMiddleware?: Parameters<typeof createApp>[0]["livereloadMiddleware"];
}) {
	const auth = initInMemoryAuth();
	const articleStore = initInMemoryArticleStore();
	const parser = initReadabilityParser({ fetchHtml: stubFetchHtml });
	const oauthModel = createOAuthModel(initInMemoryOAuthModel());

	const app = createApp({
		...auth,
		...articleStore,
		...parser,
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
		livereloadMiddleware: options?.livereloadMiddleware,
	});

	return { app, auth, articleStore, parser, oauthModel };
}

export function createTestAppWithFetchHtml(fetchHtml: FetchHtml) {
	const auth = initInMemoryAuth();
	const articleStore = initInMemoryArticleStore();
	const parser = initReadabilityParser({ fetchHtml });
	const oauthModel = createOAuthModel(initInMemoryOAuthModel());

	const app = createApp({
		...auth,
		...articleStore,
		...parser,
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
	});

	return { app, auth, articleStore, parser, oauthModel };
}
