import type { Express } from "express";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Logger } from "../infra/logger";
import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initDynamoDbAuth } from "./providers/auth/dynamodb-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { initDynamoDbArticleStore } from "./providers/article-store/dynamodb-article-store";
import type { ParseArticle } from "./providers/article-parser/article-parser.types";
import { initFetchHtmlWithHeaders } from "./providers/article-parser/fetch-html";
import { initFetchConditional } from "./providers/article-parser/fetch-conditional";
import { parseHtml } from "./providers/article-parser/readability-parser";
import { initRefreshArticleIfStale } from "./providers/article-freshness/check-content-freshness";
import {
	createOAuthModel,
	initInMemoryOAuthModel,
} from "./providers/oauth/oauth-model";
import { initDynamoDbOAuthModel } from "./providers/oauth/dynamodb-oauth-model";
import { createValidateAccessToken } from "./providers/oauth/validate-access-token";
import { initLogEmail } from "./providers/email/log-email";
import { initResendEmail } from "./providers/email/resend-email";
import { initInMemoryEmailVerification } from "./providers/email-verification/in-memory-email-verification";
import { initDynamoDbEmailVerification } from "./providers/email-verification/dynamodb-email-verification";
import Anthropic from "@anthropic-ai/sdk";
import { initClaudeSummarizer } from "./providers/article-summary/claude-summarizer";
import { initDynamoDbSummaryCache } from "./providers/article-summary/dynamodb-summary-cache";
import { initInMemorySummaryCache } from "./providers/article-summary/in-memory-summary-cache";
import { stripHtml } from "./providers/article-summary/strip-html";
import { initGmailApi } from "./providers/gmail/gmail-api";
import { initDynamoDbGmailTokenStore } from "./providers/gmail/dynamodb-gmail-token-store";
import { initInMemoryGmailTokenStore } from "./providers/gmail/in-memory-gmail-token-store";
import { initGmailImport } from "./providers/gmail/gmail-import";
import { qualifyLink } from "./domain/gmail-import/qualify-link";
import { initEnsureValidAccessToken } from "./providers/gmail/ensure-valid-access-token";
import { consoleLogger } from "@packages/hutch-logger";
import { createApp } from "./server";
import { getEnv, requireEnv } from "./require-env";

function initProviders() {
	const persistence = requireEnv<"prod" | "development">("PERSISTENCE");
	const anthropicApiKey = requireEnv("ANTHROPIC_API_KEY");
	const anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
	const logError = (message: string, error?: Error) => console.error(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), message, stack: error?.stack }));

	const fetchHtmlWithHeaders = initFetchHtmlWithHeaders({ fetch: globalThis.fetch });
	const fetchConditional = initFetchConditional({ fetch: globalThis.fetch });
	const staleTtlMs = 86400000;

	if (persistence === "prod") {
		const googleClientId = requireEnv("GOOGLE_CLIENT_ID");
		const googleClientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
		const gmailApi = initGmailApi({
			fetch: globalThis.fetch,
			clientId: googleClientId,
			clientSecret: googleClientSecret,
		});

		const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
		const userArticlesTable = requireEnv("DYNAMODB_USER_ARTICLES_TABLE");
		const usersTable = requireEnv("DYNAMODB_USERS_TABLE");
		const sessionsTable = requireEnv("DYNAMODB_SESSIONS_TABLE");
		const oauthTable = requireEnv("DYNAMODB_OAUTH_TABLE");
		const verificationTokensTable = requireEnv("DYNAMODB_VERIFICATION_TOKENS_TABLE");
		const gmailTokensTable = requireEnv("DYNAMODB_GMAIL_TOKENS_TABLE");
		const resendApiKey = requireEnv("RESEND_API_KEY");
		const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

		const auth = initDynamoDbAuth({ client, usersTableName: usersTable, sessionsTableName: sessionsTable });
		const articleStore = initDynamoDbArticleStore({ client, tableName: articlesTable, userArticlesTableName: userArticlesTable });
		const oauthModel = initDynamoDbOAuthModel({ client, tableName: oauthTable });
		const summaryCache = initDynamoDbSummaryCache({ client, tableName: articlesTable });
		const { summarizeArticle } = initClaudeSummarizer({
			createMessage: (params) => anthropicClient.messages.create(params),
			logger: consoleLogger,
			cleanContent: stripHtml,
			...summaryCache,
		});
		const { refreshArticleIfStale } = initRefreshArticleIfStale({
			findArticleFreshness: articleStore.findArticleFreshness,
			fetchConditional,
			fetchHtmlWithHeaders,
			parseHtml,
			updateArticleContent: articleStore.updateArticleContent,
			updateArticleFetchMetadata: articleStore.updateArticleFetchMetadata,
			clearArticleSummary: articleStore.clearArticleSummary,
			logError,
			now: () => new Date(),
			staleTtlMs,
		});
		const gmailTokenStore = initDynamoDbGmailTokenStore({ client, tableName: gmailTokensTable });

		return {
			auth,
			articleStore,
			...initResendEmail(resendApiKey),
			...initDynamoDbEmailVerification({ client, tableName: verificationTokensTable }),
			oauthModel,
			validateAccessToken: createValidateAccessToken(oauthModel),
			summarizeArticle,
			findCachedSummary: summaryCache.findCachedSummary,
			refreshArticleIfStale,
			...gmailTokenStore,
			...gmailApi,
			googleClientId,
			qualifyLink,
		};
	}

	const googleClientId = "dev-google-client-id";
	const gmailApi = initGmailApi({
		fetch: globalThis.fetch,
		clientId: googleClientId,
		clientSecret: "dev-google-client-secret",
	});

	const auth = initInMemoryAuth();
	const articleStore = initInMemoryArticleStore();
	const oauthModel = createOAuthModel(initInMemoryOAuthModel());
	const summaryCache = initInMemorySummaryCache();
	const { summarizeArticle } = initClaudeSummarizer({
		createMessage: (params) => {
			// Log the call without full content to avoid flooding CI logs (Wikipedia articles are 100KB+)
			consoleLogger.info(`[AI Summary Stub] model=${params.model} content_length=${params.messages[0]?.content?.length ?? 0}`);
			return Promise.resolve({
				content: [{
					type: "text",
					text: JSON.stringify({ summary: `[AI Summary Stub] for model ${params.model}` })
				}],
				usage: { input_tokens: 0, output_tokens: 0 }
			})
		},
		logger: consoleLogger,
		cleanContent: stripHtml,
		...summaryCache,
	});
	const { refreshArticleIfStale } = initRefreshArticleIfStale({
		findArticleFreshness: articleStore.findArticleFreshness,
		fetchConditional,
		fetchHtmlWithHeaders,
		parseHtml,
		updateArticleContent: articleStore.updateArticleContent,
		updateArticleFetchMetadata: articleStore.updateArticleFetchMetadata,
		clearArticleSummary: articleStore.clearArticleSummary,
		logError,
		now: () => new Date(),
		staleTtlMs,
	});

	const gmailTokenStore = initInMemoryGmailTokenStore();

	return {
		auth,
		articleStore,
		...initLogEmail(),
		...initInMemoryEmailVerification(),
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
		summarizeArticle,
		findCachedSummary: summaryCache.findCachedSummary,
		refreshArticleIfStale,
		...gmailTokenStore,
		...gmailApi,
		googleClientId,
		qualifyLink,
	};
}

export function createHutchApp(deps: {
	parseArticle: ParseArticle;
	appOrigin?: string;
}) {
	const { auth, articleStore, oauthModel, validateAccessToken, ...providers } = initProviders();

	const appOrigin = deps.appOrigin ?? requireEnv("APP_ORIGIN", { defaultValue: `http://localhost:${getEnv("PORT") || "3000"}` });
	const staticBaseUrl = requireEnv("STATIC_BASE_URL");
	const logError = (message: string, error?: Error) => console.error(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), message, stack: error?.stack }));

	const ensureValidAccessToken = initEnsureValidAccessToken({
		findGmailTokens: providers.findGmailTokens,
		saveGmailTokens: providers.saveGmailTokens,
		refreshGmailAccessToken: providers.refreshGmailAccessToken,
	});

	const { runGmailImport } = initGmailImport({
		getGmailMessage: providers.getGmailMessage,
		ensureGmailLabel: providers.ensureGmailLabel,
		labelGmailMessage: providers.labelGmailMessage,
		ensureValidAccessToken,
		saveArticle: articleStore.saveArticle,
		parseArticle: deps.parseArticle,
		qualifyLink,
		logError,
	});

	const app = createApp({
		appOrigin,
		staticBaseUrl,
		...auth,
		...articleStore,
		parseArticle: deps.parseArticle,
		...providers,
		baseUrl: appOrigin,
		logError,
		oauthModel,
		validateAccessToken,
		runGmailImport,
		ensureValidAccessToken,
	});

	return { app, auth, articleStore, oauthModel };
}

export const localServer = (expressApp: Express, logger: Logger): void => {
	const port = getEnv("PORT") || "3000";
	expressApp.listen(Number.parseInt(port, 10), () => {
		logger.info(`Local server running on http://localhost:${port}`);
	});
};
