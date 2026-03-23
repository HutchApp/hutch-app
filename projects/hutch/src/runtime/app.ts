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
		const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
		const userArticlesTable = requireEnv("DYNAMODB_USER_ARTICLES_TABLE");
		const usersTable = requireEnv("DYNAMODB_USERS_TABLE");
		const sessionsTable = requireEnv("DYNAMODB_SESSIONS_TABLE");
		const oauthTable = requireEnv("DYNAMODB_OAUTH_TABLE");
		const verificationTokensTable = requireEnv("DYNAMODB_VERIFICATION_TOKENS_TABLE");
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
		};
	}

	const auth = initInMemoryAuth();
	const articleStore = initInMemoryArticleStore();
	const oauthModel = createOAuthModel(initInMemoryOAuthModel());
	const summaryCache = initInMemorySummaryCache();
	const { summarizeArticle } = initClaudeSummarizer({
		createMessage: (params) => {
			// Output a log for the call outside prod environment to avoid spending tokens running e2e tests in local machine and CI environments
			consoleLogger.info(`[AI Summary Called] with params ${JSON.stringify(params)}`);
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
	};
}

export function createHutchApp(deps: {
	parseArticle: ParseArticle;
	appOrigin?: string;
}) {
	const { auth, articleStore, oauthModel, validateAccessToken, ...providers } = initProviders();

	const appOrigin = deps.appOrigin ?? requireEnv("APP_ORIGIN", { defaultValue: `http://localhost:${getEnv("PORT") || "3000"}` });

	const app = createApp({
		appOrigin,
		...auth,
		...articleStore,
		parseArticle: deps.parseArticle,
		...providers,
		baseUrl: appOrigin,
		logError: (message, error) => console.error(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), message, stack: error?.stack })),
		oauthModel,
		validateAccessToken,
	});

	return { app, auth, articleStore, oauthModel };
}

export const localServer = (expressApp: Express, logger: Logger): void => {
	const port = getEnv("PORT") || "3000";
	expressApp.listen(Number.parseInt(port, 10), () => {
		logger.info(`Local server running on http://localhost:${port}`);
	});
};
