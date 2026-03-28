import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import Anthropic from "@anthropic-ai/sdk";
import { consoleLogger } from "@packages/hutch-logger";
import { EventBridgeClient, initEventBridgePublisher } from "@packages/hutch-event-bridge/runtime";
import { initFindArticleContent } from "../save-link/find-article-content";
import { initClaudeSummarizer } from "../generate-summary/claude-summarizer";
import { initDynamoDbSummaryCache } from "../generate-summary/dynamodb-summary-cache";
import { stripHtml } from "../generate-summary/strip-html";
import { initGenerateSummaryHandler } from "../generate-summary/generate-summary-handler";

const articlesTable = process.env.DYNAMODB_ARTICLES_TABLE;
if (!articlesTable) throw new Error("DYNAMODB_ARTICLES_TABLE is required");

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is required");

const eventBusName = process.env.EVENT_BUS_NAME;
if (!eventBusName) throw new Error("EVENT_BUS_NAME is required");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const anthropicClient = new Anthropic({ apiKey: anthropicApiKey });

const { findArticleContent } = initFindArticleContent({
	client,
	tableName: articlesTable,
});

const summaryCache = initDynamoDbSummaryCache({
	client,
	tableName: articlesTable,
});

const { summarizeArticle } = initClaudeSummarizer({
	createMessage: (params) => anthropicClient.messages.create(params),
	logger: consoleLogger,
	cleanContent: stripHtml,
	...summaryCache,
});

const { publishEvent } = initEventBridgePublisher({
	client: new EventBridgeClient({}),
	eventBusName,
});

export const handler = initGenerateSummaryHandler({
	summarizeArticle,
	findArticleContent,
	publishEvent,
	logger: consoleLogger,
});
