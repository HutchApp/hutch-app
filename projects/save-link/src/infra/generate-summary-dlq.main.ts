import { createDynamoDocumentClient } from "@packages/hutch-storage-client";
import { consoleLogger } from "@packages/hutch-logger";
import { EventBridgeClient, initEventBridgePublisher } from "@packages/hutch-infra-components/runtime";
import { requireEnv } from "../require-env";
import { initDynamoDbGeneratedSummary } from "../generate-summary/dynamodb-generated-summary";
import { initGenerateSummaryDlqHandler } from "../generate-summary/generate-summary-dlq-handler";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const eventBusName = requireEnv("EVENT_BUS_NAME");

const dynamoClient = createDynamoDocumentClient();

const summaryStore = initDynamoDbGeneratedSummary({
	client: dynamoClient,
	tableName: articlesTable,
});

const { publishEvent } = initEventBridgePublisher({
	client: new EventBridgeClient({}),
	eventBusName,
});

export const handler = initGenerateSummaryDlqHandler({
	markSummaryFailed: summaryStore.markSummaryFailed,
	publishEvent,
	logger: consoleLogger,
});
