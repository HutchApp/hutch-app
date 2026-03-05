import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import type { FetchHtml } from "./providers/article-parser/readability-parser";
import {
	createOAuthModel,
	initInMemoryOAuthModel,
	type OAuthModel,
	type OAuthModelDeps,
} from "./providers/oauth/oauth-model";
import type { AccessToken } from "./domain/oauth/oauth.types";
import type { UserId } from "./domain/user/user.types";
import { createApp } from "./server";

const stubFetchHtml: FetchHtml = async (url) => {
	const hostname = new URL(url).hostname;
	return `<html><head><title>Article from ${hostname}</title></head><body><article><p>Content saved from ${hostname}.</p></article></body></html>`;
};

function createValidateAccessToken(model: OAuthModel) {
	return async (accessToken: AccessToken): Promise<UserId | null> => {
		const token = await model.getAccessToken(accessToken);
		if (!token) return null;
		return token.user.id as UserId;
	};
}

export function createTestApp() {
	const auth = initInMemoryAuth();
	const articleStore = initInMemoryArticleStore();
	const parser = initReadabilityParser({ fetchHtml: stubFetchHtml });
	const oauthModelDeps: OAuthModelDeps = initInMemoryOAuthModel();
	const oauthModel = createOAuthModel(oauthModelDeps);

	const app = createApp({
		...auth,
		...articleStore,
		...parser,
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
	});

	return { app, auth, articleStore, parser, oauthModel, oauthModelDeps };
}

export function createTestAppWithFetchHtml(fetchHtml: FetchHtml) {
	const auth = initInMemoryAuth();
	const articleStore = initInMemoryArticleStore();
	const parser = initReadabilityParser({ fetchHtml });
	const oauthModelDeps: OAuthModelDeps = initInMemoryOAuthModel();
	const oauthModel = createOAuthModel(oauthModelDeps);

	const app = createApp({
		...auth,
		...articleStore,
		...parser,
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
	});

	return { app, auth, articleStore, parser, oauthModel, oauthModelDeps };
}
