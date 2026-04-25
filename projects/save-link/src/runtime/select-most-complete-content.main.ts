import { S3Client } from "@aws-sdk/client-s3";
import OpenAI from "openai";
import { consoleLogger } from "@packages/hutch-logger";
import { createDynamoDocumentClient } from "@packages/hutch-storage-client";
import { EventBridgeClient, initEventBridgePublisher } from "@packages/hutch-infra-components/runtime";
import { requireEnv } from "../require-env";
import { initReadTierSource } from "../select-content/read-tier-source";
import { initListAvailableTierSources } from "../select-content/list-available-tier-sources";
import { initSelectMostCompleteContent } from "../select-content/select-content";
import { initPromoteTierToCanonical } from "../select-content/promote-tier-to-canonical";
import { initFindContentSourceTier } from "../select-content/find-content-source-tier";
import { initSelectMostCompleteContentHandler } from "../select-content/select-most-complete-content-handler";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const contentBucketName = requireEnv("CONTENT_BUCKET_NAME");
const eventBusName = requireEnv("EVENT_BUS_NAME");
const deepseekApiKey = requireEnv("DEEPSEEK_API_KEY");

const s3Client = new S3Client({});
const dynamoClient = createDynamoDocumentClient();
const deepseekClient = new OpenAI({
	apiKey: deepseekApiKey,
	baseURL: "https://api.deepseek.com",
	timeout: 60_000,
});

const { readTierSource } = initReadTierSource({
	client: s3Client,
	bucketName: contentBucketName,
	logger: consoleLogger,
});

const { listAvailableTierSources } = initListAvailableTierSources({ readTierSource });

const { selectMostCompleteContent } = initSelectMostCompleteContent({
	createChatCompletion: (params) => deepseekClient.chat.completions.create(params),
	logger: consoleLogger,
});

const { promoteTierToCanonical } = initPromoteTierToCanonical({
	dynamoClient,
	s3Client,
	tableName: articlesTable,
	bucketName: contentBucketName,
	now: () => new Date(),
});

const { findContentSourceTier } = initFindContentSourceTier({
	dynamoClient,
	tableName: articlesTable,
});

const { publishEvent } = initEventBridgePublisher({
	client: new EventBridgeClient({}),
	eventBusName,
});

export const handler = initSelectMostCompleteContentHandler({
	listAvailableTierSources,
	selectMostCompleteContent,
	promoteTierToCanonical,
	findContentSourceTier,
	publishEvent,
	logger: consoleLogger,
});
