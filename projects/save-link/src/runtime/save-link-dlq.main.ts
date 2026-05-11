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
import { initSaveLinkDlqHandler } from "../crawl-article-state/save-link-dlq-handler";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const eventBusName = requireEnv("EVENT_BUS_NAME");
const generateSummaryQueueUrl = requireEnv("GENERATE_SUMMARY_QUEUE_URL");

const dynamoClient = createDynamoDocumentClient();
const logger = HutchLogger.from(consoleLogger);

const store = initDynamoDbArticleStore({
	client: dynamoClient,
	tableName: articlesTable,
	logger,
});

const { publishEvent } = initEventBridgePublisher({
	client: new EventBridgeClient({}),
	eventBusName,
});

const { dispatch: dispatchGenerateSummary } = initSqsCommandDispatcher({
	sqsClient: new SQSClient({}),
	queueUrl: generateSummaryQueueUrl,
	command: GenerateSummaryCommand,
});

const dispatcher = initLambdaEffectDispatcher({
	publishEvent,
	dispatchGenerateSummary,
});

const transitionAndPersist = initTransitionAndPersist({ store, dispatcher });

export const handler = initSaveLinkDlqHandler({
	transitionAndPersist,
	now: () => new Date(),
	logger,
});
