import type { Express } from "express";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { HutchLogger } from "hutch-logger";
import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initDynamoDbAuth } from "./providers/auth/dynamodb-auth";
import { initInMemoryArticleStore } from "./providers/article-store/in-memory-article-store";
import { initDynamoDbArticleStore } from "./providers/article-store/dynamodb-article-store";
import { initReadabilityParser } from "./providers/article-parser/readability-parser";
import type { FetchHtml } from "./providers/article-parser/readability-parser";
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
	if (getEnv("NODE_ENV") === "production") {
		const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
		const usersTable = requireEnv("DYNAMODB_USERS_TABLE");
		const sessionsTable = requireEnv("DYNAMODB_SESSIONS_TABLE");
		const oauthTable = requireEnv("DYNAMODB_OAUTH_TABLE");
		const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

		const oauthModel = initDynamoDbOAuthModel({ client, tableName: oauthTable });
		return {
			...initDynamoDbAuth({ client, usersTableName: usersTable, sessionsTableName: sessionsTable }),
			...initDynamoDbArticleStore({ client, tableName: articlesTable }),
			oauthModel,
			validateAccessToken: createValidateAccessToken(oauthModel),
		};
	}

	const oauthModel = createOAuthModel(initInMemoryOAuthModel());
	return {
		...initInMemoryAuth(),
		...initInMemoryArticleStore(),
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
	};
}

export const app = createApp({
	...initProviders(),
	...initReadabilityParser({ fetchHtml }),
});

export const localServer = (expressApp: Express, logger: HutchLogger): void => {
	const port = getEnv("PORT") || "3000";
	expressApp.listen(Number.parseInt(port, 10), () => {
		logger.info(`Local server running on http://localhost:${port}`);
	});
};
