import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SQSClient } from "@aws-sdk/client-sqs";
import { consoleLogger } from "@packages/hutch-logger";
import { requireEnv } from "../require-env";
import { initFindArticleContent } from "../save-link/find-article-content";
import { initLinkSavedHandler } from "../save-link/link-saved-handler";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const generateSummaryQueueUrl = requireEnv("GENERATE_SUMMARY_QUEUE_URL");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sqsClient = new SQSClient({});

const { findArticleContent } = initFindArticleContent({
	client,
	tableName: articlesTable,
});

export const handler = initLinkSavedHandler({
	sqsClient,
	queueUrl: generateSummaryQueueUrl,
	findArticleContent,
	logger: consoleLogger,
});
