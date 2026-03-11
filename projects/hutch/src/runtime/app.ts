import type { Express } from "express";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Logger } from "../infra/logger";
import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initDynamoDbAuth } from "./providers/auth/dynamodb-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { initDynamoDbArticleStore } from "./providers/article-store/dynamodb-article-store";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import type { FetchHtml } from "./providers/article-parser/readability-parser";
import type { ParseArticle } from "./providers/article-parser/article-parser.types";
import {
	createOAuthModel,
	initInMemoryOAuthModel,
} from "./providers/oauth/oauth-model";
import { initDynamoDbOAuthModel } from "./providers/oauth/dynamodb-oauth-model";
import { createValidateAccessToken } from "./providers/oauth/validate-access-token";
import { createApp } from "./server";
import { getEnv, requireEnv } from "./require-env";

const FETCH_TIMEOUT_MS = 5000;

const fetchHtml: FetchHtml = async (url) => {
	try {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			headers: { accept: "text/html" },
		});
		if (!response.ok) return undefined;
		const contentType = response.headers.get("content-type") ?? "";
		if (!contentType.includes("text/html")) return undefined;
		return await response.text();
	} catch {
		return undefined;
	}
};

function initProviders() {
	const persistence = requireEnv<"prod" | "development">("PERSISTENCE");

	if (persistence === "prod") {
		const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
		const usersTable = requireEnv("DYNAMODB_USERS_TABLE");
		const sessionsTable = requireEnv("DYNAMODB_SESSIONS_TABLE");
		const oauthTable = requireEnv("DYNAMODB_OAUTH_TABLE");
		const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

		const auth = initDynamoDbAuth({ client, usersTableName: usersTable, sessionsTableName: sessionsTable });
		const articleStore = initDynamoDbArticleStore({ client, tableName: articlesTable });
		const oauthModel = initDynamoDbOAuthModel({ client, tableName: oauthTable });
		return {
			auth,
			articleStore,
			oauthModel,
			validateAccessToken: createValidateAccessToken(oauthModel),
		};
	}

	const auth = initInMemoryAuth();
	const articleStore = initInMemoryArticleStore();
	const oauthModel = createOAuthModel(initInMemoryOAuthModel());
	return {
		auth,
		articleStore,
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
	};
}

export function createHutchApp(options?: {
	parseArticle?: ParseArticle;
	livereloadMiddleware?: Parameters<typeof createApp>[0]["livereloadMiddleware"];
}) {
	const { auth, articleStore, oauthModel, validateAccessToken } = initProviders();
	const parser = options?.parseArticle
		? { parseArticle: options.parseArticle }
		: initReadabilityParser({ fetchHtml });

	const app = createApp({
		...auth,
		...articleStore,
		...parser,
		oauthModel,
		validateAccessToken,
		livereloadMiddleware: options?.livereloadMiddleware,
	});

	return { app, auth, articleStore, parser, oauthModel };
}

export const localServer = (expressApp: Express, logger: Logger): void => {
	const port = getEnv("PORT") || "3000";
	expressApp.listen(Number.parseInt(port, 10), () => {
		logger.info(`Local server running on http://localhost:${port}`);
	});
};
