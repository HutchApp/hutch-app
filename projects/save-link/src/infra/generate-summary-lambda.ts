import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import Anthropic, { APIError } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { consoleLogger } from "@packages/hutch-logger";
import { EventBridgeClient, initEventBridgePublisher } from "@packages/hutch-infra-components/runtime";
import { requireEnv } from "../require-env";
import { initFindArticleContent } from "../save-link/find-article-content";
import { initLinkSummariser } from "../generate-summary/link-summariser";
import { initCreateMessageWithFallback } from "../generate-summary/create-message-with-fallback";
import { initCreateDeepseekMessage } from "../generate-summary/create-deepseek-message";
import type { CreateAiMessage } from "../generate-summary/article-summary.types";
import { MAX_SUMMARY_LENGTH } from "../generate-summary/max-summary-length";
import { initDynamoDbSummaryCache } from "../generate-summary/dynamodb-summary-cache";
import { stripHtml } from "../generate-summary/strip-html";
import { initGenerateSummaryHandler } from "../generate-summary/generate-summary-handler";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const anthropicApiKey = requireEnv("ANTHROPIC_API_KEY");
const deepseekApiKey = requireEnv("DEEPSEEK_API_KEY");
const eventBusName = requireEnv("EVENT_BUS_NAME");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
const deepseekClient = new OpenAI({ apiKey: deepseekApiKey, baseURL: "https://api.deepseek.com" });

const claudeAdapter: CreateAiMessage = (params) => anthropicClient.messages.create(params);

const deepseekAdapter = initCreateDeepseekMessage({
	createChatCompletion: (params) => deepseekClient.chat.completions.create(params),
});

const { findArticleContent } = initFindArticleContent({
	client,
	tableName: articlesTable,
});

const summaryCache = initDynamoDbSummaryCache({
	client,
	tableName: articlesTable,
});

const createMessage = initCreateMessageWithFallback({
	primary: claudeAdapter,
	fallback: deepseekAdapter,
	shouldFallback: (error) => error instanceof APIError,
	logger: consoleLogger,
});

const { summarizeArticle } = initLinkSummariser({
	createMessage,
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
