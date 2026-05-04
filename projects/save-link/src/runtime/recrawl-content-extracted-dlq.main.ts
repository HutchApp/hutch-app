import { createDynamoDocumentClient } from "@packages/hutch-storage-client";
import { consoleLogger } from "@packages/hutch-logger";
import { EventBridgeClient, initEventBridgePublisher } from "@packages/hutch-infra-components/runtime";
import { requireEnv } from "../require-env";
import { initDynamoDbArticleCrawl } from "../crawl-article-state/dynamodb-article-crawl";
import { initDynamoDbGeneratedSummary } from "../generate-summary/dynamodb-generated-summary";
import { initRecrawlContentExtractedDlqHandler } from "../select-content/recrawl-content-extracted-dlq-handler";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const eventBusName = requireEnv("EVENT_BUS_NAME");

const dynamoClient = createDynamoDocumentClient();

const crawlStore = initDynamoDbArticleCrawl({
	client: dynamoClient,
	tableName: articlesTable,
});

const summaryStore = initDynamoDbGeneratedSummary({
	client: dynamoClient,
	tableName: articlesTable,
});

const { publishEvent } = initEventBridgePublisher({
	client: new EventBridgeClient({}),
	eventBusName,
});

export const handler = initRecrawlContentExtractedDlqHandler({
	markCrawlFailed: crawlStore.markCrawlFailed,
	markSummaryFailed: summaryStore.markSummaryFailed,
	publishEvent,
	logger: consoleLogger,
});
