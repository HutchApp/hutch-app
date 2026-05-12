import { SQSClient } from "@aws-sdk/client-sqs";
import { createDynamoDocumentClient } from "@packages/hutch-storage-client";
import { consoleLogger } from "@packages/hutch-logger";
import {
	EventBridgeClient,
	initEventBridgePublisher,
	initSqsCommandDispatcher,
} from "@packages/hutch-infra-components/runtime";
import { GenerateSummaryCommand } from "@packages/hutch-infra-components";
import { initTransitionAndPersist } from "@packages/domain/article-aggregate";
import { requireEnv } from "../require-env";
import { initSelectMostCompleteContentDlqHandler } from "../select-content/select-most-complete-content-dlq-handler";
import { initDynamoDbArticleStore } from "../article-aggregate/dynamodb-article-store";
import { initLambdaEffectDispatcher } from "../article-aggregate/lambda-effect-dispatcher";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const eventBusName = requireEnv("EVENT_BUS_NAME");
const generateSummaryQueueUrl = requireEnv("GENERATE_SUMMARY_QUEUE_URL");

const dynamoClient = createDynamoDocumentClient();
const sqsClient = new SQSClient({});

const { store } = initDynamoDbArticleStore({
	client: dynamoClient,
	tableName: articlesTable,
});

const { publishEvent } = initEventBridgePublisher({
	client: new EventBridgeClient({}),
	eventBusName,
});

const { dispatch: dispatchGenerateSummary } = initSqsCommandDispatcher({
	sqsClient,
	queueUrl: generateSummaryQueueUrl,
	command: GenerateSummaryCommand,
});

const { dispatchEffect } = initLambdaEffectDispatcher({
	dispatchGenerateSummary,
	publishEvent,
});

const { transitionAndPersist } = initTransitionAndPersist({
	store,
	dispatchEffect,
});

export const handler = initSelectMostCompleteContentDlqHandler({
	transitionAndPersist,
	logger: consoleLogger,
});
