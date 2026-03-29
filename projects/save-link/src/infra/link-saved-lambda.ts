import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SQSClient } from "@aws-sdk/client-sqs";
import { consoleLogger } from "@packages/hutch-logger";
import { initFindArticleContent } from "../save-link/find-article-content";
import { initLinkSavedHandler } from "../save-link/link-saved-handler";

const articlesTable = process.env.DYNAMODB_ARTICLES_TABLE;
if (!articlesTable) throw new Error("DYNAMODB_ARTICLES_TABLE is required");

const generateSummaryQueueUrl = process.env.GENERATE_SUMMARY_QUEUE_URL;
if (!generateSummaryQueueUrl) throw new Error("GENERATE_SUMMARY_QUEUE_URL is required");

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
