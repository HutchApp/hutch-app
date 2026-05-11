import { SQSClient } from "@aws-sdk/client-sqs";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { createDynamoDocumentClient } from "@packages/hutch-storage-client";
import { consoleLogger, HutchLogger } from "@packages/hutch-logger";
import {
	initEventBridgePublisher,
	initSqsCommandDispatcher,
} from "@packages/hutch-infra-components/runtime";
import { GenerateSummaryCommand } from "@packages/hutch-infra-components";
import {
	initDynamoDbArticleStore,
	initLambdaEffectDispatcher,
} from "@packages/article-aggregate-store";
import { initTransitionAndPersist } from "@packages/domain/article";
import { requireEnv } from "../require-env";
import { initRefreshArticleContentHandler } from "../save-link/refresh-article-content-handler";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const generateSummaryQueueUrl = requireEnv("GENERATE_SUMMARY_QUEUE_URL");
const eventBusName = requireEnv("EVENT_BUS_NAME");

const client = createDynamoDocumentClient();
const sqsClient = new SQSClient({});
const eventBridgeClient = new EventBridgeClient({});
const logger = HutchLogger.from(consoleLogger);

const store = initDynamoDbArticleStore({
	client,
	tableName: articlesTable,
	logger,
});

const { dispatch: dispatchGenerateSummary } = initSqsCommandDispatcher({
	sqsClient,
	queueUrl: generateSummaryQueueUrl,
	command: GenerateSummaryCommand,
});

const { publishEvent } = initEventBridgePublisher({
	client: eventBridgeClient,
	eventBusName,
});

const dispatcher = initLambdaEffectDispatcher({
	publishEvent,
	dispatchGenerateSummary,
});

const transitionAndPersist = initTransitionAndPersist({ store, dispatcher });

export const handler = initRefreshArticleContentHandler({
	transitionAndPersist,
	logger,
});
