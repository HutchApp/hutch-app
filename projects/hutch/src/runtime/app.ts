import type { Express } from "express";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Logger } from "../infra/logger";
import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initDynamoDbAuth } from "./providers/auth/dynamodb-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { initDynamoDbArticleStore } from "./providers/article-store/dynamodb-article-store";
import type { ParseArticle } from "./providers/article-parser/article-parser.types";
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
import { createApp } from "./server";
import { getEnv, requireEnv } from "./require-env";

function initProviders() {
	const persistence = requireEnv<"prod" | "development">("PERSISTENCE");
	const anthropicApiKey = requireEnv("ANTHROPIC_API_KEY");
	const anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
	const logError = (message: string, error?: Error) => console.error(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), message, stack: error?.stack }));

	if (persistence === "prod") {
		const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
		const usersTable = requireEnv("DYNAMODB_USERS_TABLE");
		const sessionsTable = requireEnv("DYNAMODB_SESSIONS_TABLE");
		const oauthTable = requireEnv("DYNAMODB_OAUTH_TABLE");
		const verificationTokensTable = requireEnv("DYNAMODB_VERIFICATION_TOKENS_TABLE");
		const summaryCacheTable = requireEnv("DYNAMODB_SUMMARY_CACHE_TABLE");
		const resendApiKey = requireEnv("RESEND_API_KEY");
		const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

		const auth = initDynamoDbAuth({ client, usersTableName: usersTable, sessionsTableName: sessionsTable });
		const articleStore = initDynamoDbArticleStore({ client, tableName: articlesTable });
		const oauthModel = initDynamoDbOAuthModel({ client, tableName: oauthTable });
		const summaryCache = initDynamoDbSummaryCache({ client, tableName: summaryCacheTable });
		const { summarizeArticle } = initClaudeSummarizer({
			createMessage: (params) => anthropicClient.messages.create(params),
			logError,
			cleanContent: stripHtml,
			...summaryCache,
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
		};
	}

	const auth = initInMemoryAuth();
	const articleStore = initInMemoryArticleStore();
	const oauthModel = createOAuthModel(initInMemoryOAuthModel());
	const summaryCache = initInMemorySummaryCache();
	const { summarizeArticle } = initClaudeSummarizer({
		createMessage: (params) => anthropicClient.messages.create(params),
		logError,
		cleanContent: stripHtml,
		...summaryCache,
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
