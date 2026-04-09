import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { consoleLogger } from "@packages/hutch-logger";
import { requireEnv } from "../require-env";
import { initFindArticleContent } from "../save-link/find-article-content";
import { initLinkSavedHandler } from "../save-link/link-saved-handler";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const generateSummaryQueueUrl = requireEnv("GENERATE_SUMMARY_QUEUE_URL");

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});
const sqsClient = new SQSClient({});

const { findArticleContent } = initFindArticleContent({
	dynamoClient,
	s3Client,
	tableName: articlesTable,
});

export const handler = initLinkSavedHandler({
	sqsClient,
	queueUrl: generateSummaryQueueUrl,
	findArticleContent,
	logger: consoleLogger,
});
