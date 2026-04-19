import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { ArticleResourceUniqueId } from "@packages/article-resource-unique-id";
import type { CrawlArticle } from "@packages/crawl-article";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import type { ParseArticle } from "./providers/article-parser/article-parser.types";
import type { PublishLinkSaved } from "./providers/events/publish-link-saved.types";
import type { PublishSaveAnonymousLink } from "./providers/events/publish-save-anonymous-link.types";
import type { PublishUpdateFetchTimestamp } from "./providers/events/publish-update-fetch-timestamp.types";
import { initInMemoryLinkSaved } from "./providers/events/in-memory-link-saved";
import { initInMemorySaveAnonymousLink } from "./providers/events/in-memory-save-anonymous-link";
import { initInMemoryUpdateFetchTimestamp } from "./providers/events/in-memory-update-fetch-timestamp";
import type { FindCachedSummary } from "./providers/article-summary/article-summary.types";
import type { RefreshArticleIfStale } from "./providers/article-freshness/check-content-freshness";
import { initInMemoryEmail } from "./providers/email/in-memory-email";
import { initInMemoryEmailVerification } from "./providers/email-verification/in-memory-email-verification";
import { initInMemoryPasswordReset } from "./providers/password-reset/in-memory-password-reset";
import type { ExchangeGoogleCode } from "./providers/google-auth/google-token.types";
import {
	createOAuthModel,
	initInMemoryOAuthModel,
} from "./providers/oauth/oauth-model";
import { createValidateAccessToken } from "./providers/oauth/validate-access-token";
import { noopLogger } from "@packages/hutch-logger";
import type { LogParseError } from "./providers/parse-errors/log-parse-error";
import { createApp } from "./server";
import { httpErrorMessageMapping as defaultHttpErrorMessageMapping, type HttpErrorMessageMapping } from "./web/pages/queue/queue.error";

const { publishUpdateFetchTimestamp: defaultPublishUpdateFetchTimestamp } = initInMemoryUpdateFetchTimestamp({ logger: noopLogger });
const noopCheckFreshness: RefreshArticleIfStale = async () => ({ action: "new" });

const stubCrawlArticle: CrawlArticle = async ({ url }) => {
	const hostname = new URL(url).hostname;
	return {
		status: "fetched",
		html: `<html><head><title>Article from ${hostname}</title></head><body><article><p>Content saved from ${hostname}.</p></article></body></html>`,
	};
};

export function createTestApp(options?: {
	articleStore?: ReturnType<typeof initInMemoryArticleStore>;
	parseArticle?: ParseArticle;
	crawlArticle?: CrawlArticle;
	publishLinkSaved?: PublishLinkSaved;
	publishSaveAnonymousLink?: PublishSaveAnonymousLink;
	publishUpdateFetchTimestamp?: PublishUpdateFetchTimestamp;
	findCachedSummary?: FindCachedSummary;
	refreshArticleIfStale?: RefreshArticleIfStale;
	httpErrorMessageMapping?: HttpErrorMessageMapping;
	exchangeGoogleCode?: ExchangeGoogleCode;
	logError?: (message: string, error?: Error) => void;
	logParseError?: LogParseError;
	appOrigin?: string;
}) {
	const auth = initInMemoryAuth();
	const articleStore = options?.articleStore ?? initInMemoryArticleStore();
	const crawlArticle = options?.crawlArticle ?? stubCrawlArticle;
	const parser = initReadabilityParser({ crawlArticle });
	const appOrigin = options?.appOrigin ?? "http://localhost:3000";
	const oauthModel = createOAuthModel(initInMemoryOAuthModel(), { appOrigin });
	const email = initInMemoryEmail();
	const emailVerification = initInMemoryEmailVerification();
	const passwordReset = initInMemoryPasswordReset();

	const { publishLinkSaved: logOnlyPublishLinkSaved } = initInMemoryLinkSaved({ logger: noopLogger });
	const defaultPublishLinkSaved: PublishLinkSaved = async (params) => {
		await logOnlyPublishLinkSaved(params);
		const result = await parser.parseArticle(params.url);
		if (result.ok) {
			await articleStore.writeContent({ url: params.url, content: result.article.content });
		}
	};

	const { publishSaveAnonymousLink: logOnlyPublishSaveAnonymousLink } = initInMemorySaveAnonymousLink({ logger: noopLogger });
	const defaultPublishSaveAnonymousLink: PublishSaveAnonymousLink = async (params) => {
		await logOnlyPublishSaveAnonymousLink(params);
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
		readArticleContent: (url) => articleStore.readContent(ArticleResourceUniqueId.parse(url)),
		parseArticle: options?.parseArticle ?? parser.parseArticle,
		publishLinkSaved: options?.publishLinkSaved ?? defaultPublishLinkSaved,
		publishSaveAnonymousLink: options?.publishSaveAnonymousLink ?? defaultPublishSaveAnonymousLink,
		publishUpdateFetchTimestamp: options?.publishUpdateFetchTimestamp ?? defaultPublishUpdateFetchTimestamp,
		findCachedSummary: options?.findCachedSummary ?? (async () => ""),
		refreshArticleIfStale: options?.refreshArticleIfStale ?? noopCheckFreshness,
		httpErrorMessageMapping: options?.httpErrorMessageMapping ?? defaultHttpErrorMessageMapping,
		...email,
		...emailVerification,
		...passwordReset,
		googleAuth: options?.exchangeGoogleCode
			? {
				exchangeGoogleCode: options.exchangeGoogleCode,
				clientId: "test-google-client-id",
				clientSecret: "test-google-client-secret",
			}
			: undefined,
		baseUrl: appOrigin,
		logError: options?.logError ?? (() => {}),
		logParseError: options?.logParseError ?? (() => {}),
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
	});

	return { app, auth, articleStore, parser, oauthModel, email, emailVerification, passwordReset };
}
