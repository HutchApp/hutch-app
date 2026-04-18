/* c8 ignore start -- composition root, no logic to test */
import assert from "node:assert";
import type { Express } from "express";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Logger } from "../infra/logger";
import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initDynamoDbAuth } from "./providers/auth/dynamodb-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { initDynamoDbArticleStore } from "./providers/article-store/dynamodb-article-store";
import type { ParseArticle } from "./providers/article-parser/article-parser.types";
import { DEFAULT_CRAWL_HEADERS, initCrawlArticle } from "@packages/crawl-article";
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
import { initInMemoryPasswordReset } from "./providers/password-reset/in-memory-password-reset";
import { initDynamoDbPasswordReset } from "./providers/password-reset/dynamodb-password-reset";
import { initDynamoDbSummaryCache } from "./providers/article-summary/dynamodb-summary-cache";
import { S3Client } from "@aws-sdk/client-s3";
import { initS3ReadContent } from "./providers/article-store/s3-read-content";
import { initReadArticleContent } from "./providers/article-store/read-article-content";
import { EventBridgeClient, initEventBridgePublisher } from "@packages/hutch-infra-components/runtime";
import { initEventBridgeLinkSaved } from "./providers/events/eventbridge-link-saved";
import { initEventBridgeSaveAnonymousLink } from "./providers/events/eventbridge-save-anonymous-link";
import { initEventBridgeRefreshArticleContent } from "./providers/events/eventbridge-refresh-article-content";
import { initEventBridgeUpdateFetchTimestamp } from "./providers/events/eventbridge-update-fetch-timestamp";
import { initInMemoryLinkSaved } from "./providers/events/in-memory-link-saved";
import { initInMemorySaveAnonymousLink } from "./providers/events/in-memory-save-anonymous-link";
import { initInMemoryRefreshArticleContent } from "./providers/events/in-memory-refresh-article-content";
import { initInMemoryUpdateFetchTimestamp } from "./providers/events/in-memory-update-fetch-timestamp";
import { initExchangeGoogleCode } from "./providers/google-auth/google-token";
import { consoleLogger } from "@packages/hutch-logger";
import { createApp } from "./server";
import { httpErrorMessageMapping } from "./web/pages/queue/queue.error";
import { getEnv, requireEnv } from "./require-env";

function initProviders() {
	const persistence = requireEnv<"prod" | "development">("PERSISTENCE");
	const logError = (message: string, error?: Error) => console.error(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), message, stack: error?.stack }));

	const crawlArticle = initCrawlArticle({ fetch: globalThis.fetch, logError, headers: { ...DEFAULT_CRAWL_HEADERS } });
	const staleTtlMs = 86400000;

	if (persistence === "prod") {
		const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
		const userArticlesTable = requireEnv("DYNAMODB_USER_ARTICLES_TABLE");
		const usersTable = requireEnv("DYNAMODB_USERS_TABLE");
		const sessionsTable = requireEnv("DYNAMODB_SESSIONS_TABLE");
		const oauthTable = requireEnv("DYNAMODB_OAUTH_TABLE");
		const verificationTokensTable = requireEnv("DYNAMODB_VERIFICATION_TOKENS_TABLE");
		const passwordResetTokensTable = requireEnv("DYNAMODB_PASSWORD_RESET_TOKENS_TABLE");
		const googleClientId = requireEnv("GOOGLE_LOGIN_CLIENT_ID");
		const googleClientSecret = requireEnv("GOOGLE_LOGIN_CLIENT_SECRET");
		const appOriginForRedirect = requireEnv("APP_ORIGIN");
		const resendApiKey = requireEnv("RESEND_API_KEY");
		const eventBusName = requireEnv("EVENT_BUS_NAME");
		const contentBucketName = requireEnv("CONTENT_BUCKET_NAME");
		const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

		const auth = initDynamoDbAuth({ client, usersTableName: usersTable, sessionsTableName: sessionsTable });
		const articleStore = initDynamoDbArticleStore({ client, tableName: articlesTable, userArticlesTableName: userArticlesTable });
		const readArticleContent = initReadArticleContent({
			storageProviderQueryOrder: [
				initS3ReadContent({ client: new S3Client({}), bucketName: contentBucketName }),
				articleStore.readContent, // Legacy fallback for articles saved before S3 migration
			],
			logError,
		});
		const oauthModel = initDynamoDbOAuthModel({ client, tableName: oauthTable });
		const summaryCache = initDynamoDbSummaryCache({ client, tableName: articlesTable });
		const { publishEvent } = initEventBridgePublisher({
			client: new EventBridgeClient({}),
			eventBusName,
		});
		const { publishLinkSaved } = initEventBridgeLinkSaved({ publishEvent });
		const { publishSaveAnonymousLink } = initEventBridgeSaveAnonymousLink({ publishEvent });
		const { publishRefreshArticleContent } = initEventBridgeRefreshArticleContent({ publishEvent });
		const { publishUpdateFetchTimestamp } = initEventBridgeUpdateFetchTimestamp({ publishEvent });
		const { refreshArticleIfStale } = initRefreshArticleIfStale({
			findArticleFreshness: articleStore.findArticleFreshness,
			crawlArticle,
			parseHtml,
			publishRefreshArticleContent,
			publishUpdateFetchTimestamp,
			now: () => new Date(),
			staleTtlMs,
		});
		const googleAuth = {
			exchangeGoogleCode: initExchangeGoogleCode({
				clientId: googleClientId,
				clientSecret: googleClientSecret,
				redirectUri: `${appOriginForRedirect}/auth/google/callback`,
				fetch: globalThis.fetch,
			}),
			clientId: googleClientId,
			clientSecret: googleClientSecret,
		};

		return {
			auth,
			articleStore,
			readArticleContent,

			...initResendEmail(resendApiKey),
			...initDynamoDbEmailVerification({ client, tableName: verificationTokensTable }),
			...initDynamoDbPasswordReset({ client, tableName: passwordResetTokensTable }),
			googleAuth,
			oauthModel,
			validateAccessToken: createValidateAccessToken(oauthModel),
			publishLinkSaved,
			publishSaveAnonymousLink,
			publishUpdateFetchTimestamp,
			findCachedSummary: summaryCache.findCachedSummary,
			refreshArticleIfStale,
		};
	}

	const auth = initInMemoryAuth();
	const articleStore = initInMemoryArticleStore();
	const oauthModel = createOAuthModel(initInMemoryOAuthModel());
	const devGoogleClientId = getEnv("GOOGLE_LOGIN_CLIENT_ID");
	const devGoogleClientSecret = getEnv("GOOGLE_LOGIN_CLIENT_SECRET");
	assert(
		(devGoogleClientId && devGoogleClientSecret) || (!devGoogleClientId && !devGoogleClientSecret),
		"GOOGLE_LOGIN_CLIENT_ID and GOOGLE_LOGIN_CLIENT_SECRET must both be set or both unset",
	);
	const googleAuth = devGoogleClientId && devGoogleClientSecret
		? {
			exchangeGoogleCode: initExchangeGoogleCode({
				clientId: devGoogleClientId,
				clientSecret: devGoogleClientSecret,
				redirectUri: `http://localhost:${getEnv("PORT") || "3000"}/auth/google/callback`,
				fetch: globalThis.fetch,
			}),
			clientId: devGoogleClientId,
			clientSecret: devGoogleClientSecret,
		}
		: undefined;
	const { publishLinkSaved: logOnlyPublishLinkSaved } = initInMemoryLinkSaved({ logger: consoleLogger });
	const publishLinkSaved: typeof logOnlyPublishLinkSaved = async (params) => {
		await logOnlyPublishLinkSaved(params);
		const crawlResult = await crawlArticle({ url: params.url });
		if (crawlResult.status !== "fetched") return;
		const result = parseHtml({ url: params.url, html: crawlResult.html });
		if (result.ok) {
			await articleStore.writeContent({ url: params.url, content: result.article.content });
		}
	};
	const { publishSaveAnonymousLink: logOnlyPublishSaveAnonymousLink } = initInMemorySaveAnonymousLink({ logger: consoleLogger });
	const publishSaveAnonymousLink: typeof logOnlyPublishSaveAnonymousLink = async (params) => {
		await logOnlyPublishSaveAnonymousLink(params);
		const crawlResult = await crawlArticle({ url: params.url });
		if (crawlResult.status !== "fetched") return;
		const result = parseHtml({ url: params.url, html: crawlResult.html });
		if (result.ok) {
			await articleStore.writeContent({ url: params.url, content: result.article.content });
		}
	};
	const { publishRefreshArticleContent } = initInMemoryRefreshArticleContent({ logger: consoleLogger });
	const { publishUpdateFetchTimestamp } = initInMemoryUpdateFetchTimestamp({ logger: consoleLogger });
	const stubFindCachedSummary = async (_url: string) => "";
	const { refreshArticleIfStale } = initRefreshArticleIfStale({
		findArticleFreshness: articleStore.findArticleFreshness,
		crawlArticle,
		parseHtml,
		publishRefreshArticleContent,
		publishUpdateFetchTimestamp,
		now: () => new Date(),
		staleTtlMs,
	});

	return {
		auth,
		articleStore,
		readArticleContent: initReadArticleContent({
			storageProviderQueryOrder: [articleStore.readContent],
			logError,
		}),

		...initLogEmail(),
		...initInMemoryEmailVerification(),
		...initInMemoryPasswordReset(),
		googleAuth,
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
		publishLinkSaved,
		publishSaveAnonymousLink,
		publishUpdateFetchTimestamp,
		findCachedSummary: stubFindCachedSummary,
		refreshArticleIfStale,
	};
}

export function createHutchApp(deps: {
	parseArticle: ParseArticle;
	appOrigin?: string;
}) {
	const { auth, articleStore, oauthModel, validateAccessToken, ...providers } = initProviders();

	const appOrigin = deps.appOrigin ?? requireEnv("APP_ORIGIN", { defaultValue: `http://localhost:${getEnv("PORT") || "3000"}` });
	const staticBaseUrl = requireEnv("STATIC_BASE_URL");

	const app = createApp({
		appOrigin,
		staticBaseUrl,
		...auth,
		...articleStore,
		parseArticle: deps.parseArticle,
		...providers,
		baseUrl: appOrigin,
		logError: (message, error) => console.error(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), message, stack: error?.stack })),
		oauthModel,
		validateAccessToken,
		httpErrorMessageMapping,
	});

	return { app, auth, articleStore, oauthModel };
}

export const localServer = (expressApp: Express, logger: Logger): void => {
	const port = getEnv("PORT") || "3000";
	expressApp.listen(Number.parseInt(port, 10), () => {
		logger.info(`Local server running on http://localhost:${port}`);
	});
};
/* c8 ignore stop */
