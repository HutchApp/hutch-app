import type { CreateAiMessage } from "./article-summary.types";
import { initClaudeSummarizer } from "./claude-summarizer";

function createDeps(overrides?: {
	createMessage?: CreateAiMessage;
	findCachedSummary?: (url: string) => Promise<string>;
	saveCachedSummary?: (params: { url: string; summary: string }) => Promise<void>;
	logError?: (message: string, error?: Error) => void;
}) {
	return {
		createMessage: overrides?.createMessage ?? jest.fn<Promise<{ content: Array<{ type: string; text?: string }> }>, [unknown]>().mockResolvedValue({
			content: [{ type: "text", text: "A concise summary." }],
		}),
		findCachedSummary: overrides?.findCachedSummary ?? jest.fn<Promise<string>, [string]>().mockResolvedValue(""),
		saveCachedSummary: overrides?.saveCachedSummary ?? jest.fn<Promise<void>, [{ url: string; summary: string }]>().mockResolvedValue(undefined),
		logError: overrides?.logError ?? jest.fn(),
	};
}

describe("initClaudeSummarizer", () => {
	it("should return cached summary without calling createMessage", async () => {
		const deps = createDeps({
			findCachedSummary: jest.fn<Promise<string>, [string]>().mockResolvedValue("Cached summary."),
		});
		const { summarizeArticle } = initClaudeSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/article", textContent: "Some content" });

		expect(result).toBe("Cached summary.");
		expect(deps.createMessage).not.toHaveBeenCalled();
	});

	it("should call createMessage and save summary on cache miss", async () => {
		const deps = createDeps();
		const { summarizeArticle } = initClaudeSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/article", textContent: "Some content" });

		expect(result).toBe("A concise summary.");
		expect(deps.createMessage).toHaveBeenCalledTimes(1);
		expect(deps.saveCachedSummary).toHaveBeenCalledWith({ url: "https://example.com/article", summary: "A concise summary." });
	});

	it("should return null when Claude responds with 'Summary not available.'", async () => {
		const deps = createDeps({
			createMessage: jest.fn<Promise<{ content: Array<{ type: string; text?: string }> }>, [unknown]>().mockResolvedValue({
				content: [{ type: "text", text: "Summary not available." }],
			}),
		});
		const { summarizeArticle } = initClaudeSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/article", textContent: "Short" });

		expect(result).toBeNull();
		expect(deps.saveCachedSummary).not.toHaveBeenCalled();
	});

	it("should return null and log error when createMessage throws", async () => {
		const apiError = new Error("API rate limited");
		const deps = createDeps({
			createMessage: jest.fn<Promise<{ content: Array<{ type: string; text?: string }> }>, [unknown]>().mockRejectedValue(apiError),
		});
		const { summarizeArticle } = initClaudeSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/article", textContent: "Content" });

		expect(result).toBeNull();
		expect(deps.logError).toHaveBeenCalledWith("Failed to summarize article", apiError);
	});

	it("should return null when response has no text block", async () => {
		const deps = createDeps({
			createMessage: jest.fn<Promise<{ content: Array<{ type: string; text?: string }> }>, [unknown]>().mockResolvedValue({
				content: [],
			}),
		});
		const { summarizeArticle } = initClaudeSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/article", textContent: "Content" });

		expect(result).toBeNull();
	});

	it("should truncate content to 20000 characters before sending", async () => {
		const deps = createDeps();
		const { summarizeArticle } = initClaudeSummarizer(deps);
		const longContent = "a".repeat(25_000);

		await summarizeArticle({ url: "https://example.com/article", textContent: longContent });

		const callArgs = (deps.createMessage as jest.Mock).mock.calls[0][0];
		expect(callArgs.messages[0].content).toHaveLength(20_000);
	});
});
