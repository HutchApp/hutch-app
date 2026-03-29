import { noopLogger } from "@packages/hutch-logger";
import type { CreateChatCompletion } from "./article-summary.types";
import { initDeepseekSummarizer } from "./deepseek-summarizer";

const passthrough = (s: string) => s;

function createDeps(overrides?: {
	createChatCompletion?: CreateChatCompletion;
	findCachedSummary?: (url: string) => Promise<string>;
	saveCachedSummary?: (params: { url: string; summary: string; inputTokens: number; outputTokens: number }) => Promise<void>;
	cleanContent?: (html: string) => string;
}) {
	return {
		createChatCompletion: overrides?.createChatCompletion ?? jest.fn<Promise<{ content: string | null; usage: { prompt_tokens: number; completion_tokens: number } }>, [unknown]>().mockResolvedValue({
			content: "A concise summary.",
			usage: { prompt_tokens: 150, completion_tokens: 42 },
		}),
		findCachedSummary: overrides?.findCachedSummary ?? jest.fn<Promise<string>, [string]>().mockResolvedValue(""),
		saveCachedSummary: overrides?.saveCachedSummary ?? jest.fn<Promise<void>, [{ url: string; summary: string; inputTokens: number; outputTokens: number }]>().mockResolvedValue(undefined),
		logger: noopLogger,
		cleanContent: overrides?.cleanContent ?? passthrough,
	};
}

describe("initDeepseekSummarizer", () => {
	it("should return cached summary without calling createChatCompletion", async () => {
		const deps = createDeps({
			findCachedSummary: jest.fn<Promise<string>, [string]>().mockResolvedValue("Cached summary."),
		});
		const { summarizeArticle } = initDeepseekSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/article", textContent: "Some content" });

		expect(result).toBe("Cached summary.");
		expect(deps.createChatCompletion).not.toHaveBeenCalled();
	});

	it("should call createChatCompletion and save summary with token counts on cache miss", async () => {
		const deps = createDeps();
		const { summarizeArticle } = initDeepseekSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/article", textContent: "Some content" });

		expect(result).toBe("A concise summary.");
		expect(deps.createChatCompletion).toHaveBeenCalledTimes(1);
		const callArgs = (deps.createChatCompletion as jest.Mock).mock.calls[0][0];
		expect(callArgs.model).toBe("deepseek-chat");
		expect(callArgs.max_tokens).toBe(8192);
		expect(callArgs.messages).toEqual([
			{ role: "system", content: expect.any(String) },
			{ role: "user", content: "Some content" },
		]);
		expect(deps.saveCachedSummary).toHaveBeenCalledWith({
			url: "https://example.com/article",
			summary: "A concise summary.",
			inputTokens: 150,
			outputTokens: 42,
		});
	});

	it("should return null when DeepSeek responds with 'Summary not available.'", async () => {
		const deps = createDeps({
			createChatCompletion: jest.fn<Promise<{ content: string | null; usage: { prompt_tokens: number; completion_tokens: number } }>, [unknown]>().mockResolvedValue({
				content: "Summary not available.",
				usage: { prompt_tokens: 50, completion_tokens: 5 },
			}),
		});
		const { summarizeArticle } = initDeepseekSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/article", textContent: "Short" });

		expect(result).toBeNull();
		expect(deps.saveCachedSummary).not.toHaveBeenCalled();
	});

	it("should return null and log error when createChatCompletion throws", async () => {
		const apiError = new Error("API rate limited");
		const logger = { ...noopLogger, error: jest.fn() };
		const deps = createDeps({
			createChatCompletion: jest.fn<Promise<{ content: string | null; usage: { prompt_tokens: number; completion_tokens: number } }>, [unknown]>().mockRejectedValue(apiError),
		});
		const { summarizeArticle } = initDeepseekSummarizer({ ...deps, logger });

		const result = await summarizeArticle({ url: "https://example.com/article", textContent: "Content" });

		expect(result).toBeNull();
		expect(logger.error).toHaveBeenCalledWith("[summarize] failed to summarize article", apiError);
	});

	it("should return null when response content is null", async () => {
		const deps = createDeps({
			createChatCompletion: jest.fn<Promise<{ content: string | null; usage: { prompt_tokens: number; completion_tokens: number } }>, [unknown]>().mockResolvedValue({
				content: null,
				usage: { prompt_tokens: 100, completion_tokens: 0 },
			}),
		});
		const { summarizeArticle } = initDeepseekSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/article", textContent: "Content" });

		expect(result).toBeNull();
	});

	it("should pass content through cleanContent before sending to DeepSeek", async () => {
		const cleanContent = jest.fn((s: string) => s.toUpperCase());
		const deps = createDeps({ cleanContent });
		const { summarizeArticle } = initDeepseekSummarizer(deps);

		await summarizeArticle({ url: "https://example.com/article", textContent: "hello world" });

		expect(cleanContent).toHaveBeenCalledWith("hello world");
		const callArgs = (deps.createChatCompletion as jest.Mock).mock.calls[0][0];
		expect(callArgs.messages[1].content).toBe("HELLO WORLD");
	});
});
