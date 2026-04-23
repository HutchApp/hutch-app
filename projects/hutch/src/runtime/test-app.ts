import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { ArticleResourceUniqueId } from "@packages/article-resource-unique-id";
import type { CrawlArticle } from "@packages/crawl-article";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import type { ParseArticle } from "./providers/article-parser/article-parser.types";
import { calculateReadTime } from "./domain/article/estimated-read-time";
import type { PublishLinkSaved } from "./providers/events/publish-link-saved.types";
import type { PublishSaveAnonymousLink } from "./providers/events/publish-save-anonymous-link.types";
import type { PublishUpdateFetchTimestamp } from "./providers/events/publish-update-fetch-timestamp.types";
import { initInMemoryLinkSaved } from "./providers/events/in-memory-link-saved";
import { initInMemorySaveAnonymousLink } from "./providers/events/in-memory-save-anonymous-link";
import { initInMemoryUpdateFetchTimestamp } from "./providers/events/in-memory-update-fetch-timestamp";
import type {
	FindGeneratedSummary,
	MarkSummaryPending,
} from "./providers/article-summary/article-summary.types";
import type {
	FindArticleCrawlStatus,
	MarkCrawlPending,
} from "./providers/article-crawl/article-crawl.types";
import { initInMemoryArticleCrawl } from "./providers/article-crawl/in-memory-article-crawl";
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
	articleCrawl?: ReturnType<typeof initInMemoryArticleCrawl>;
	parseArticle?: ParseArticle;
	crawlArticle?: CrawlArticle;
	publishLinkSaved?: PublishLinkSaved;
	publishSaveAnonymousLink?: PublishSaveAnonymousLink;
	publishUpdateFetchTimestamp?: PublishUpdateFetchTimestamp;
	findGeneratedSummary?: FindGeneratedSummary;
	markSummaryPending?: MarkSummaryPending;
	findArticleCrawlStatus?: FindArticleCrawlStatus;
	markCrawlPending?: MarkCrawlPending;
	refreshArticleIfStale?: RefreshArticleIfStale;
	httpErrorMessageMapping?: HttpErrorMessageMapping;
	exchangeGoogleCode?: ExchangeGoogleCode;
	logError?: (message: string, error?: Error) => void;
	appOrigin?: string;
}) {
	const auth = initInMemoryAuth();
	const articleStore = options?.articleStore ?? initInMemoryArticleStore();
	const articleCrawl = options?.articleCrawl ?? initInMemoryArticleCrawl();
	const crawlArticle = options?.crawlArticle ?? stubCrawlArticle;
	const parser = initReadabilityParser({ crawlArticle });
	const parseArticle = options?.parseArticle ?? parser.parseArticle;
	const appOrigin = options?.appOrigin ?? "http://localhost:3000";
	const oauthModel = createOAuthModel(initInMemoryOAuthModel(), { appOrigin });
	const email = initInMemoryEmail();
	const emailVerification = initInMemoryEmailVerification();
	const passwordReset = initInMemoryPasswordReset();

	// Test-only fixture for the async crawl worker: parses (using the injected
	// parseArticle so test cases can simulate parse failures or specific
	// metadata), writes parsed metadata + content, then flips crawlStatus
	// before the awaited publish returns. This makes the route test render
	// the post-worker state in a single synchronous request.
	const applyParseResult = async (url: string) => {
		const result = await parseArticle(url);
		if (!result.ok) {
			await articleCrawl.markCrawlFailed({ url, reason: result.reason });
			return;
		}
		const estimatedReadTime = calculateReadTime(result.article.wordCount);
		await articleStore.writeMetadata({
			url,
			metadata: {
				title: result.article.title,
				siteName: result.article.siteName,
				excerpt: result.article.excerpt,
				wordCount: result.article.wordCount,
				...(result.article.imageUrl ? { imageUrl: result.article.imageUrl } : {}),
			},
			estimatedReadTime,
		});
		await articleStore.writeContent({ url, content: result.article.content });
		await articleCrawl.markCrawlReady({ url });
	};

	const { publishLinkSaved: logOnlyPublishLinkSaved } = initInMemoryLinkSaved({ logger: noopLogger });
	const defaultPublishLinkSaved: PublishLinkSaved = async (params) => {
		await logOnlyPublishLinkSaved(params);
		await applyParseResult(params.url);
	};

	const { publishSaveAnonymousLink: logOnlyPublishSaveAnonymousLink } = initInMemorySaveAnonymousLink({ logger: noopLogger });
	const defaultPublishSaveAnonymousLink: PublishSaveAnonymousLink = async (params) => {
		await logOnlyPublishSaveAnonymousLink(params);
		await applyParseResult(params.url);
	};

	const app = createApp({
		appOrigin,
		staticBaseUrl: "",
		...auth,
		...articleStore,
		readArticleContent: (url) => articleStore.readContent(ArticleResourceUniqueId.parse(url)),
		publishLinkSaved: options?.publishLinkSaved ?? defaultPublishLinkSaved,
		publishSaveAnonymousLink: options?.publishSaveAnonymousLink ?? defaultPublishSaveAnonymousLink,
		publishUpdateFetchTimestamp: options?.publishUpdateFetchTimestamp ?? defaultPublishUpdateFetchTimestamp,
		findGeneratedSummary: options?.findGeneratedSummary ?? (async () => undefined),
		markSummaryPending: options?.markSummaryPending ?? (async () => {}),
		findArticleCrawlStatus: options?.findArticleCrawlStatus ?? articleCrawl.findArticleCrawlStatus,
		markCrawlPending: options?.markCrawlPending ?? articleCrawl.markCrawlPending,
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
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
	});

	return { app, auth, articleStore, articleCrawl, parser, oauthModel, email, emailVerification, passwordReset };
}
