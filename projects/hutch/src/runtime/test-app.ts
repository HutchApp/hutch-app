import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import type { FetchHtml } from "./providers/article-parser/readability-parser";
import type { ParseArticle } from "./providers/article-parser/article-parser.types";
import type { PublishLinkSaved } from "./providers/events/publish-link-saved.types";
import { initInMemoryLinkSaved } from "./providers/events/in-memory-link-saved";
import type { FindCachedSummary } from "./providers/article-summary/article-summary.types";
import type { RefreshArticleIfStale } from "./providers/article-freshness/check-content-freshness";
import { initInMemoryEmail } from "./providers/email/in-memory-email";
import { initInMemoryEmailVerification } from "./providers/email-verification/in-memory-email-verification";
import { initInMemoryPasswordReset } from "./providers/password-reset/in-memory-password-reset";
import {
	createOAuthModel,
	initInMemoryOAuthModel,
} from "./providers/oauth/oauth-model";
import { createValidateAccessToken } from "./providers/oauth/validate-access-token";
import { createApp } from "./server";
import { noopLogger } from "@packages/hutch-logger";

const { publishLinkSaved: defaultPublishLinkSaved } = initInMemoryLinkSaved({ logger: noopLogger });
const noopCheckFreshness: RefreshArticleIfStale = async () => ({ action: "new" });

const stubFetchHtml: FetchHtml = async (url) => {
	const hostname = new URL(url).hostname;
	return `<html><head><title>Article from ${hostname}</title></head><body><article><p>Content saved from ${hostname}.</p></article></body></html>`;
};

export function createTestApp(options?: {
	parseArticle?: ParseArticle;
	fetchHtml?: FetchHtml;
	publishLinkSaved?: PublishLinkSaved;
	findCachedSummary?: FindCachedSummary;
	refreshArticleIfStale?: RefreshArticleIfStale;
	logError?: (message: string, error?: Error) => void;
}) {
	const auth = initInMemoryAuth();
	const articleStore = initInMemoryArticleStore();
	const parser = initReadabilityParser({ fetchHtml: options?.fetchHtml ?? stubFetchHtml });
	const oauthModel = createOAuthModel(initInMemoryOAuthModel());
	const email = initInMemoryEmail();
	const emailVerification = initInMemoryEmailVerification();
	const passwordReset = initInMemoryPasswordReset();

	const app = createApp({
		appOrigin: "http://localhost:3000",
		staticBaseUrl: "",
		...auth,
		...articleStore,
		parseArticle: options?.parseArticle ?? parser.parseArticle,
		publishLinkSaved: options?.publishLinkSaved ?? defaultPublishLinkSaved,
		findCachedSummary: options?.findCachedSummary ?? (async () => ""),
		refreshArticleIfStale: options?.refreshArticleIfStale ?? noopCheckFreshness,
		...email,
		...emailVerification,
		...passwordReset,
		baseUrl: "http://localhost:3000",
		logError: options?.logError ?? (() => {}),
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
	});

	return { app, auth, articleStore, parser, oauthModel, email, emailVerification, passwordReset };
}
