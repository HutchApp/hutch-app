import { noopLogger } from "@packages/hutch-logger";
import { initDeepseekSummarizer } from "./deepseek-summarizer";
import type {
	CreateChatCompletion,
	FindCachedSummary,
	SaveCachedSummary,
} from "./article-summary.types";

function createStubCreateChatCompletion(summary: string): CreateChatCompletion {
	return async () => ({
		content: summary,
		usage: { prompt_tokens: 50, completion_tokens: 10 },
	});
}

const noCache: FindCachedSummary = async () => "";
const noopSave: SaveCachedSummary = async () => {};
const identity = (text: string) => text;

describe("initDeepseekSummarizer", () => {
	it("should skip summarisation when isTooShortToSummarize returns true", async () => {
		const createChatCompletion = jest.fn();

		const { summarizeArticle } = initDeepseekSummarizer({
			createChatCompletion,
			findCachedSummary: noCache,
			saveCachedSummary: noopSave,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => true,
		});

		const result = await summarizeArticle({
			url: "https://example.com/short",
			textContent: "Short article text.",
		});

		expect(result).toBeNull();
		expect(createChatCompletion).not.toHaveBeenCalled();
	});

	it("should call createChatCompletion when isTooShortToSummarize returns false", async () => {
		const createChatCompletion = createStubCreateChatCompletion("A good summary.");

		const { summarizeArticle } = initDeepseekSummarizer({
			createChatCompletion,
			findCachedSummary: noCache,
			saveCachedSummary: noopSave,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => false,
		});

		const result = await summarizeArticle({
			url: "https://example.com/long",
			textContent: "A long article with lots of content.",
		});

		expect(result).toEqual({
			summary: "A good summary.",
			inputTokens: 50,
			outputTokens: 10,
		});
	});

	it("should return null on cache hit without calling createChatCompletion", async () => {
		const createChatCompletion = jest.fn();
		const cachedSummary: FindCachedSummary = async () => "cached summary";

		const { summarizeArticle } = initDeepseekSummarizer({
			createChatCompletion,
			findCachedSummary: cachedSummary,
			saveCachedSummary: noopSave,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => false,
		});

		const result = await summarizeArticle({
			url: "https://example.com/cached",
			textContent: "Some content.",
		});

		expect(result).toBeNull();
		expect(createChatCompletion).not.toHaveBeenCalled();
	});

	it("should return null when DeepSeek returns 'Summary not available.'", async () => {
		const createChatCompletion = createStubCreateChatCompletion("Summary not available.");

		const { summarizeArticle } = initDeepseekSummarizer({
			createChatCompletion,
			findCachedSummary: noCache,
			saveCachedSummary: noopSave,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => false,
		});

		const result = await summarizeArticle({
			url: "https://example.com/unavailable",
			textContent: "Content that cannot be summarised.",
		});

		expect(result).toBeNull();
	});
});
