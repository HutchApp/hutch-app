import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import Anthropic from "@anthropic-ai/sdk";
import { consoleLogger } from "@packages/hutch-logger";
import { EventBridgeClient, initEventBridgePublisher } from "@packages/hutch-infra-components/runtime";
import { requireEnv } from "../require-env";
import { initFindArticleContent } from "../save-link/find-article-content";
import { initLinkSummariser } from "../generate-summary/link-summariser";
import { MAX_SUMMARY_LENGTH } from "../generate-summary/max-summary-length";
import { initDynamoDbSummaryCache } from "../generate-summary/dynamodb-summary-cache";
import { stripHtml } from "../generate-summary/strip-html";
import { initGenerateSummaryHandler } from "../generate-summary/generate-summary-handler";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const anthropicApiKey = requireEnv("ANTHROPIC_API_KEY");
const eventBusName = requireEnv("EVENT_BUS_NAME");

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

const { summarizeArticle } = initLinkSummariser({
	createMessage: (params) => anthropicClient.messages.create(params),
	logger: consoleLogger,
	cleanContent: stripHtml,
	isTooShortToSummarize: (cleanedText) => {
		const visibleLength = cleanedText.replace(/\s/g, "").length;
		return visibleLength <= MAX_SUMMARY_LENGTH * 3;
	},
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
