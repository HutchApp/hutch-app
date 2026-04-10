import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { ArticleUniqueId } from "@packages/article-unique-id";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import type { FetchHtml } from "./providers/article-parser/readability-parser";
import type { ParseArticle } from "./providers/article-parser/article-parser.types";
import type { PublishLinkSaved } from "./providers/events/publish-link-saved.types";
import type { PublishUpdateFetchTimestamp } from "./providers/events/publish-update-fetch-timestamp.types";
import { initInMemoryLinkSaved } from "./providers/events/in-memory-link-saved";
import { initInMemoryUpdateFetchTimestamp } from "./providers/events/in-memory-update-fetch-timestamp";
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
import { noopLogger } from "@packages/hutch-logger";
import { createApp } from "./server";

const { publishUpdateFetchTimestamp: defaultPublishUpdateFetchTimestamp } = initInMemoryUpdateFetchTimestamp({ logger: noopLogger });
const noopCheckFreshness: RefreshArticleIfStale = async () => ({ action: "new" });

const stubFetchHtml: FetchHtml = async (url) => {
	const hostname = new URL(url).hostname;
	return `<html><head><title>Article from ${hostname}</title></head><body><article><p>Content saved from ${hostname}.</p></article></body></html>`;
};

export function createTestApp(options?: {
	articleStore?: ReturnType<typeof initInMemoryArticleStore>;
	parseArticle?: ParseArticle;
	fetchHtml?: FetchHtml;
	publishLinkSaved?: PublishLinkSaved;
	publishUpdateFetchTimestamp?: PublishUpdateFetchTimestamp;
	findCachedSummary?: FindCachedSummary;
	refreshArticleIfStale?: RefreshArticleIfStale;
	logError?: (message: string, error?: Error) => void;
	appOrigin?: string;
}) {
	const auth = initInMemoryAuth();
	const articleStore = options?.articleStore ?? initInMemoryArticleStore();
	const fetchHtml = options?.fetchHtml ?? stubFetchHtml;
	const parser = initReadabilityParser({ fetchHtml });
	const appOrigin = options?.appOrigin ?? "http://localhost:3000";
	const oauthModel = createOAuthModel(initInMemoryOAuthModel(), { appOrigin });
	const email = initInMemoryEmail();
	const emailVerification = initInMemoryEmailVerification();
	const passwordReset = initInMemoryPasswordReset();

	const { publishLinkSaved: logOnlyPublish } = initInMemoryLinkSaved({ logger: noopLogger });
	const defaultPublishLinkSaved: PublishLinkSaved = async (params) => {
		await logOnlyPublish(params);
		const result = await parser.parseArticle(params.url);
		if (result.ok) {
			await articleStore.writeContent({ url: params.url, content: result.article.content });
		}
	};

	const app = createApp({
		appOrigin,
		staticBaseUrl: "",
		...auth,
		...articleStore,
		readArticleContent: (url) => articleStore.readContent(ArticleUniqueId.parse(url)),
		parseArticle: options?.parseArticle ?? parser.parseArticle,
		publishLinkSaved: options?.publishLinkSaved ?? defaultPublishLinkSaved,
		publishUpdateFetchTimestamp: options?.publishUpdateFetchTimestamp ?? defaultPublishUpdateFetchTimestamp,
		findCachedSummary: options?.findCachedSummary ?? (async () => ""),
		refreshArticleIfStale: options?.refreshArticleIfStale ?? noopCheckFreshness,
		...email,
		...emailVerification,
		...passwordReset,
		baseUrl: appOrigin,
		logError: options?.logError ?? (() => {}),
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
	});

	return { app, auth, articleStore, parser, oauthModel, email, emailVerification, passwordReset };
}
