import type { CreateAiMessage } from "./article-summary.types";
import { initClaudeSummarizer } from "./claude-summarizer";

const passthrough = (s: string) => s;

function createDeps(overrides?: {
	createMessage?: CreateAiMessage;
	findCachedSummary?: (url: string) => Promise<string>;
	saveCachedSummary?: (params: { url: string; summary: string; inputTokens: number; outputTokens: number }) => Promise<void>;
	logError?: (message: string, error?: Error) => void;
	cleanContent?: (html: string) => string;
}) {
	return {
		createMessage: overrides?.createMessage ?? jest.fn<Promise<{ content: Array<{ type: string; text?: string }>; usage: { input_tokens: number; output_tokens: number } }>, [unknown]>().mockResolvedValue({
			content: [{ type: "text", text: "A concise summary." }],
			usage: { input_tokens: 150, output_tokens: 42 },
		}),
		findCachedSummary: overrides?.findCachedSummary ?? jest.fn<Promise<string>, [string]>().mockResolvedValue(""),
		saveCachedSummary: overrides?.saveCachedSummary ?? jest.fn<Promise<void>, [{ url: string; summary: string; inputTokens: number; outputTokens: number }]>().mockResolvedValue(undefined),
		logError: overrides?.logError ?? jest.fn(),
		cleanContent: overrides?.cleanContent ?? passthrough,
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

	it("should call createMessage and save summary with token counts on cache miss", async () => {
		const deps = createDeps();
		const { summarizeArticle } = initClaudeSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/article", textContent: "Some content" });

		expect(result).toBe("A concise summary.");
		expect(deps.createMessage).toHaveBeenCalledTimes(1);
		expect(deps.saveCachedSummary).toHaveBeenCalledWith({
			url: "https://example.com/article",
			summary: "A concise summary.",
			inputTokens: 150,
			outputTokens: 42,
		});
	});

	it("should return null when Claude responds with 'Summary not available.'", async () => {
		const deps = createDeps({
			createMessage: jest.fn<Promise<{ content: Array<{ type: string; text?: string }>; usage: { input_tokens: number; output_tokens: number } }>, [unknown]>().mockResolvedValue({
				content: [{ type: "text", text: "Summary not available." }],
				usage: { input_tokens: 50, output_tokens: 5 },
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
			createMessage: jest.fn<Promise<{ content: Array<{ type: string; text?: string }>; usage: { input_tokens: number; output_tokens: number } }>, [unknown]>().mockRejectedValue(apiError),
		});
		const { summarizeArticle } = initClaudeSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/article", textContent: "Content" });

		expect(result).toBeNull();
		expect(deps.logError).toHaveBeenCalledWith("Failed to summarize article", apiError);
	});

	it("should return null when response has no text block", async () => {
		const deps = createDeps({
			createMessage: jest.fn<Promise<{ content: Array<{ type: string; text?: string }>; usage: { input_tokens: number; output_tokens: number } }>, [unknown]>().mockResolvedValue({
				content: [],
				usage: { input_tokens: 100, output_tokens: 0 },
			}),
		});
		const { summarizeArticle } = initClaudeSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/article", textContent: "Content" });

		expect(result).toBeNull();
	});

	it("should pass content through cleanContent before sending to Claude", async () => {
		const cleanContent = jest.fn((s: string) => s.toUpperCase());
		const deps = createDeps({ cleanContent });
		const { summarizeArticle } = initClaudeSummarizer(deps);

		await summarizeArticle({ url: "https://example.com/article", textContent: "hello world" });

		expect(cleanContent).toHaveBeenCalledWith("hello world");
		const callArgs = (deps.createMessage as jest.Mock).mock.calls[0][0];
		expect(callArgs.messages[0].content).toBe("HELLO WORLD");
	});
});
