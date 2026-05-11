import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { createDynamoDocumentClient } from "@packages/hutch-storage-client";
import { consoleLogger, HutchLogger } from "@packages/hutch-logger";
import { initEventBridgePublisher } from "@packages/hutch-infra-components/runtime";
import {
	initDynamoDbArticleStore,
	initLambdaEffectDispatcher,
} from "@packages/article-aggregate-store";
import { initTransitionAndPersist } from "@packages/domain/article";
import { requireEnv } from "../require-env";
import { initRecrawlLinkInitiatedDlqHandler } from "../crawl-article-state/recrawl-link-initiated-dlq-handler";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const eventBusName = requireEnv("EVENT_BUS_NAME");

const dynamoClient = createDynamoDocumentClient();
const logger = HutchLogger.from(consoleLogger);

const store = initDynamoDbArticleStore({
	client: dynamoClient,
	tableName: articlesTable,
});

const { publishEvent } = initEventBridgePublisher({
	client: new EventBridgeClient({}),
	eventBusName,
});

const dispatcher = initLambdaEffectDispatcher({ publishEvent });

const transitionAndPersist = initTransitionAndPersist({ store, dispatcher });

export const handler = initRecrawlLinkInitiatedDlqHandler({
	transitionAndPersist,
	now: () => new Date(),
	logger,
});
