import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import type { FetchHtml } from "./providers/article-parser/readability-parser";
import type { ParseArticle } from "./providers/article-parser/article-parser.types";
import type { SummarizeArticle } from "./providers/article-summary/article-summary.types";
import { initInMemorySummaryCache } from "./providers/article-summary/in-memory-summary-cache";
import type { RefreshArticleIfStale } from "./providers/article-freshness/check-content-freshness";
import { initInMemoryEmail } from "./providers/email/in-memory-email";
import { initInMemoryEmailVerification } from "./providers/email-verification/in-memory-email-verification";
import {
	createOAuthModel,
	initInMemoryOAuthModel,
} from "./providers/oauth/oauth-model";
import { createValidateAccessToken } from "./providers/oauth/validate-access-token";
import { initInMemoryGmailTokenStore } from "./providers/gmail/in-memory-gmail-token-store";
import type { RunGmailImport } from "./domain/gmail-import/gmail-import.types";
import type { ExchangeGmailCode, RefreshGmailAccessToken, ListUnreadGmailMessages } from "./providers/gmail/gmail-api.types";
import { initEnsureValidAccessToken } from "./providers/gmail/ensure-valid-access-token";
import { createApp } from "./server";

const noopSummarize: SummarizeArticle = async () => null;
const noopCheckFreshness: RefreshArticleIfStale = async () => ({ action: "new" });
const noopGmailImport: RunGmailImport = async () => ({ importedCount: 0, skippedCount: 0, emailsProcessed: 0, emailsLabeled: 0 });
const stubExchangeGmailCode: ExchangeGmailCode = async () => ({ accessToken: "stub-access", refreshToken: "stub-refresh", expiresAt: Date.now() + 3600000 });
const stubRefreshGmailAccessToken: RefreshGmailAccessToken = async ({ refreshToken }) => ({ accessToken: "refreshed-access", refreshToken, expiresAt: Date.now() + 3600000 });
const stubListUnreadGmailMessages: ListUnreadGmailMessages = async () => [
	{ messageId: "msg-1", subject: "Weekly Newsletter", from: "newsletter@example.com" },
	{ messageId: "msg-2", subject: "Your order shipped", from: "orders@shop.com" },
	{ messageId: "msg-3", subject: "Q4 Review", from: "boss@work.com" },
];

const stubFetchHtml: FetchHtml = async (url) => {
	const hostname = new URL(url).hostname;
	return `<html><head><title>Article from ${hostname}</title></head><body><article><p>Content saved from ${hostname}.</p></article></body></html>`;
};

export function createTestApp(options?: {
	parseArticle?: ParseArticle;
	fetchHtml?: FetchHtml;
	summarizeArticle?: SummarizeArticle;
	refreshArticleIfStale?: RefreshArticleIfStale;
}) {
	const auth = initInMemoryAuth();
	const articleStore = initInMemoryArticleStore();
	const parser = initReadabilityParser({ fetchHtml: options?.fetchHtml ?? stubFetchHtml });
	const oauthModel = createOAuthModel(initInMemoryOAuthModel());
	const email = initInMemoryEmail();
	const emailVerification = initInMemoryEmailVerification();
	const summaryCache = initInMemorySummaryCache();

	const baseSummarize = options?.summarizeArticle ?? noopSummarize;
	const summarizeArticle: SummarizeArticle = async (params) => {
		const summary = await baseSummarize(params);
		if (summary) {
			await summaryCache.saveCachedSummary({ url: params.url, summary, inputTokens: 0, outputTokens: 0 });
		}
		return summary;
	};

	const gmailTokenStore = initInMemoryGmailTokenStore();
	const ensureValidAccessToken = initEnsureValidAccessToken({
		...gmailTokenStore,
		refreshGmailAccessToken: stubRefreshGmailAccessToken,
	});

	const app = createApp({
		appOrigin: "http://localhost:3000",
		staticBaseUrl: "",
		...auth,
		...articleStore,
		parseArticle: options?.parseArticle ?? parser.parseArticle,
		summarizeArticle,
		findCachedSummary: summaryCache.findCachedSummary,
		refreshArticleIfStale: options?.refreshArticleIfStale ?? noopCheckFreshness,
		...email,
		...emailVerification,
		baseUrl: "http://localhost:3000",
		logError: () => {},
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
		...gmailTokenStore,
		exchangeGmailCode: stubExchangeGmailCode,
		listUnreadGmailMessages: stubListUnreadGmailMessages,
		runGmailImport: noopGmailImport,
		ensureValidAccessToken,
		googleClientId: "test-google-client-id",
	});

	return { app, auth, articleStore, parser, oauthModel, email, emailVerification, gmailTokenStore };
}
