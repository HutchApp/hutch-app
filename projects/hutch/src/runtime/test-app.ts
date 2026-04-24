import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import type { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { ArticleResourceUniqueId } from "@packages/article-resource-unique-id";
import type { CrawlArticle } from "@packages/crawl-article";
import type { ParseArticle } from "./providers/article-parser/article-parser.types";
import type { PublishLinkSaved } from "./providers/events/publish-link-saved.types";
import type { PublishSaveAnonymousLink } from "./providers/events/publish-save-anonymous-link.types";
import type { PublishUpdateFetchTimestamp } from "./providers/events/publish-update-fetch-timestamp.types";
import type {
	FindGeneratedSummary,
	MarkSummaryPending,
} from "./providers/article-summary/article-summary.types";
import type {
	FindArticleCrawlStatus,
	ForceMarkCrawlPending,
	MarkCrawlPending,
} from "./providers/article-crawl/article-crawl.types";
import type { initInMemoryArticleCrawl } from "./providers/article-crawl/in-memory-article-crawl";
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
import { createApp } from "./server";
import type { HttpErrorMessageMapping } from "./web/pages/queue/queue.error";

export function createTestApp(options: {
	articleStore: ReturnType<typeof initInMemoryArticleStore>;
	articleCrawl: ReturnType<typeof initInMemoryArticleCrawl>;
	parseArticle: ParseArticle;
	crawlArticle: CrawlArticle;
	publishLinkSaved: PublishLinkSaved;
	publishSaveAnonymousLink: PublishSaveAnonymousLink;
	publishUpdateFetchTimestamp: PublishUpdateFetchTimestamp;
	findGeneratedSummary: FindGeneratedSummary;
	markSummaryPending: MarkSummaryPending;
	findArticleCrawlStatus: FindArticleCrawlStatus;
	markCrawlPending: MarkCrawlPending;
	forceMarkCrawlPending: ForceMarkCrawlPending;
	refreshArticleIfStale: RefreshArticleIfStale;
	httpErrorMessageMapping: HttpErrorMessageMapping;
	exchangeGoogleCode: ExchangeGoogleCode | undefined;
	logError: (message: string, error?: Error) => void;
	appOrigin: string;
	adminEmails: readonly string[];
}) {
	const auth = initInMemoryAuth();
	const oauthModel = createOAuthModel(initInMemoryOAuthModel(), { appOrigin: options.appOrigin });
	const email = initInMemoryEmail();
	const emailVerification = initInMemoryEmailVerification();
	const passwordReset = initInMemoryPasswordReset();

	const app = createApp({
		appOrigin: options.appOrigin,
		staticBaseUrl: "",
		...auth,
		...options.articleStore,
		readArticleContent: (url) =>
			options.articleStore.readContent(ArticleResourceUniqueId.parse(url)),
		publishLinkSaved: options.publishLinkSaved,
		publishSaveAnonymousLink: options.publishSaveAnonymousLink,
		publishUpdateFetchTimestamp: options.publishUpdateFetchTimestamp,
		findGeneratedSummary: options.findGeneratedSummary,
		markSummaryPending: options.markSummaryPending,
		findArticleCrawlStatus: options.findArticleCrawlStatus,
		markCrawlPending: options.markCrawlPending,
		forceMarkCrawlPending: options.forceMarkCrawlPending,
		adminEmails: options.adminEmails,
		refreshArticleIfStale: options.refreshArticleIfStale,
		httpErrorMessageMapping: options.httpErrorMessageMapping,
		...email,
		...emailVerification,
		...passwordReset,
		googleAuth: options.exchangeGoogleCode
			? {
				exchangeGoogleCode: options.exchangeGoogleCode,
				clientId: "test-google-client-id",
				clientSecret: "test-google-client-secret",
			}
			: undefined,
		baseUrl: options.appOrigin,
		logError: options.logError,
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
	});

	return {
		app,
		auth,
		articleStore: options.articleStore,
		articleCrawl: options.articleCrawl,
		oauthModel,
		email,
		emailVerification,
		passwordReset,
	};
}
