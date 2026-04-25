import { createDynamoDocumentClient } from "@packages/hutch-storage-client";
import { S3Client } from "@aws-sdk/client-s3";
import OpenAI from "openai";
import { consoleLogger } from "@packages/hutch-logger";
import { EventBridgeClient, initEventBridgePublisher } from "@packages/hutch-infra-components/runtime";
import { requireEnv } from "../require-env";
import { initFindArticleContent } from "../save-link/find-article-content";
import { initLinkSummariser } from "../generate-summary/link-summariser";
import { initCreateDeepseekMessage } from "../generate-summary/create-deepseek-message";
import { MAX_SUMMARY_LENGTH } from "../generate-summary/max-summary-length";
import { GENERATE_SUMMARY_TIMEOUTS } from "../generate-summary/timeouts";
import { initDynamoDbGeneratedSummary } from "../generate-summary/dynamodb-generated-summary";
import { stripHtml } from "../generate-summary/strip-html";
import { initGenerateSummaryHandler } from "../generate-summary/generate-summary-handler";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const deepseekApiKey = requireEnv("DEEPSEEK_API_KEY");
const eventBusName = requireEnv("EVENT_BUS_NAME");

const dynamoClient = createDynamoDocumentClient();
const s3Client = new S3Client({});
const deepseekClient = new OpenAI({ apiKey: deepseekApiKey, baseURL: "https://api.deepseek.com", timeout: GENERATE_SUMMARY_TIMEOUTS.deepseekMs });

const createMessage = initCreateDeepseekMessage({
	createChatCompletion: (params) => deepseekClient.chat.completions.create(params),
});

const { findArticleContent } = initFindArticleContent({
	dynamoClient,
	s3Client,
	tableName: articlesTable,
});

const summaryStore = initDynamoDbGeneratedSummary({
	client: dynamoClient,
	tableName: articlesTable,
});

const { summarizeArticle } = initLinkSummariser({
	createMessage,
	logger: consoleLogger,
	cleanContent: stripHtml,
	isTooShortToSummarize: (cleanedText) => {
		const visibleLength = cleanedText.replace(/\s/g, "").length;
		return visibleLength <= MAX_SUMMARY_LENGTH * 3;
	},
	findGeneratedSummary: summaryStore.findGeneratedSummary,
	saveGeneratedSummary: summaryStore.saveGeneratedSummary,
	markSummarySkipped: summaryStore.markSummarySkipped,
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
