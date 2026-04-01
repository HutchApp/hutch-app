import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import OpenAI from "openai";
import { consoleLogger } from "@packages/hutch-logger";
import { EventBridgeClient, initEventBridgePublisher } from "@packages/hutch-infra-components/runtime";
import { requireEnv } from "../require-env";
import { initFindArticleContent } from "../save-link/find-article-content";
import { initDeepseekSummarizer } from "../generate-summary/deepseek-summarizer";
import { MAX_SUMMARY_LENGTH } from "../generate-summary/max-summary-length";
import { initDynamoDbSummaryCache } from "../generate-summary/dynamodb-summary-cache";
import { stripHtml } from "../generate-summary/strip-html";
import { initGenerateSummaryHandler } from "../generate-summary/generate-summary-handler";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const deepseekApiKey = requireEnv("DEEPSEEK_API_KEY");
const eventBusName = requireEnv("EVENT_BUS_NAME");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const deepseekClient = new OpenAI({ apiKey: deepseekApiKey, baseURL: "https://api.deepseek.com" });

const { findArticleContent } = initFindArticleContent({
	client,
	tableName: articlesTable,
});

const summaryCache = initDynamoDbSummaryCache({
	client,
	tableName: articlesTable,
});

const { summarizeArticle } = initDeepseekSummarizer({
	createChatCompletion: async (params) => {
		const response = await deepseekClient.chat.completions.create(params);
		return {
			content: response.choices[0]?.message?.content ?? null,
			usage: {
				prompt_tokens: response.usage?.prompt_tokens ?? 0,
				completion_tokens: response.usage?.completion_tokens ?? 0,
			},
		};
	},
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
