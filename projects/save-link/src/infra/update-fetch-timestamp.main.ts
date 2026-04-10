import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { consoleLogger } from "@packages/hutch-logger";
import { requireEnv } from "../require-env";
import { initUpdateFetchTimestamp } from "../save-link/update-fetch-timestamp";
import { initUpdateFetchTimestampHandler } from "../save-link/update-fetch-timestamp-handler";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const { updateFetchTimestamp } = initUpdateFetchTimestamp({
	client,
	tableName: articlesTable,
});

export const handler = initUpdateFetchTimestampHandler({
	updateFetchTimestamp,
	logger: consoleLogger,
});
