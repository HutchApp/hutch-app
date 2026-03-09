import type { Express } from "express";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Logger } from "../infra/logger";
import { initInMemoryAuth } from "./providers/auth/in-memory-auth";
import { initDynamoDbAuth } from "./providers/auth/dynamodb-auth";
import { initInMemoryPasswordReset } from "./providers/auth/in-memory-password-reset";
import { initDynamoDbPasswordReset } from "./providers/auth/dynamodb-password-reset";
import { initLogEmail } from "./providers/email/log-email";
import { initResendEmail } from "./providers/email/resend-email";
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
		const resendApiKey = requireEnv("RESEND_API_KEY");
		const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

		const auth = initDynamoDbAuth({ client, usersTableName: usersTable, sessionsTableName: sessionsTable });
		const passwordReset = initDynamoDbPasswordReset({ client, usersTableName: usersTable, sessionsTableName: sessionsTable });
		const oauthModel = initDynamoDbOAuthModel({ client, tableName: oauthTable });
		const { sendEmail } = initResendEmail({ apiKey: resendApiKey, fromAddress: "Hutch <noreply@hutch.sh>" });
		return {
			...auth,
			...passwordReset,
			...initDynamoDbArticleStore({ client, tableName: articlesTable }),
			oauthModel,
			validateAccessToken: createValidateAccessToken(oauthModel),
			sendEmail,
		};
	}

	const auth = initInMemoryAuth();
	const oauthModel = createOAuthModel(initInMemoryOAuthModel());
	const passwordReset = initInMemoryPasswordReset({
		userExists: auth.userExists,
		updatePasswordHash: auth.updatePasswordHash,
	});
	const { sendEmail } = initLogEmail();
	return {
		...auth,
		...initInMemoryArticleStore(),
		...passwordReset,
		oauthModel,
		validateAccessToken: createValidateAccessToken(oauthModel),
		sendEmail,
	};
}

export const app = createApp({
	...initProviders(),
	...initReadabilityParser({ fetchHtml }),
});

export const localServer = (expressApp: Express, logger: Logger): void => {
	const port = getEnv("PORT") || "3000";
	expressApp.listen(Number.parseInt(port, 10), () => {
		logger.info(`Local server running on http://localhost:${port}`);
	});
};
