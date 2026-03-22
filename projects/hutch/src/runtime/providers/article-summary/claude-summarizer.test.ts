import { initClaudeSummarizer } from "./claude-summarizer";
import type { CreateAiMessage } from "./article-summary.types";

function createFakeDeps(overrides?: {
	createMessage?: CreateAiMessage;
	cache?: Map<string, string>;
}) {
	const cache = overrides?.cache ?? new Map<string, string>();
	const createMessage: CreateAiMessage =
		overrides?.createMessage ??
		jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockResolvedValue({
			content: [{ type: "text", text: "A concise summary." }],
		});

	return {
		createMessage,
		findCachedSummary: jest.fn(async (url: string) => cache.get(url) ?? null),
		saveCachedSummary: jest.fn(async (params: { url: string; summary: string }) => {
			cache.set(params.url, params.summary);
		}),
		logError: jest.fn(),
	};
}

describe("initClaudeSummarizer", () => {
	it("returns summary from Claude when no cache exists", async () => {
		const deps = createFakeDeps();
		const { summarizeArticle } = initClaudeSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/article", textContent: "Some article content." });

		expect(result).toBe("A concise summary.");
		expect(deps.createMessage).toHaveBeenCalledTimes(1);
		expect(deps.saveCachedSummary).toHaveBeenCalledWith({ url: "https://example.com/article", summary: "A concise summary." });
	});

	it("returns cached summary without calling Claude", async () => {
		const cache = new Map([["https://example.com/cached", "Cached summary."]]);
		const deps = createFakeDeps({ cache });
		const { summarizeArticle } = initClaudeSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/cached", textContent: "Content." });

		expect(result).toBe("Cached summary.");
		expect(deps.createMessage).not.toHaveBeenCalled();
	});

	it("returns null when Claude responds with 'Summary not available.'", async () => {
		const createMessage = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockResolvedValue({
			content: [{ type: "text", text: "Summary not available." }],
		});
		const deps = createFakeDeps({ createMessage });
		const { summarizeArticle } = initClaudeSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/short", textContent: "Too short." });

		expect(result).toBeNull();
		expect(deps.saveCachedSummary).not.toHaveBeenCalled();
	});

	it("returns null and logs error when Claude API fails", async () => {
		const createMessage = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockRejectedValue(new Error("API timeout"));
		const deps = createFakeDeps({ createMessage });
		const { summarizeArticle } = initClaudeSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/fail", textContent: "Content." });

		expect(result).toBeNull();
		expect(deps.logError).toHaveBeenCalledWith("Article summarization failed", expect.any(Error));
	});

	it("returns null when response has no text block", async () => {
		const createMessage = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockResolvedValue({
			content: [],
		});
		const deps = createFakeDeps({ createMessage });
		const { summarizeArticle } = initClaudeSummarizer(deps);

		const result = await summarizeArticle({ url: "https://example.com/empty", textContent: "Content." });

		expect(result).toBeNull();
	});

	it("truncates content to 20,000 characters", async () => {
		const createMessage = jest.fn<ReturnType<CreateAiMessage>, Parameters<CreateAiMessage>>().mockResolvedValue({
			content: [{ type: "text", text: "Summary of long article." }],
		});
		const deps = createFakeDeps({ createMessage });
		const { summarizeArticle } = initClaudeSummarizer(deps);

		const longContent = "x".repeat(25_000);
		await summarizeArticle({ url: "https://example.com/long", textContent: longContent });

		const calledContent = (createMessage as jest.Mock).mock.calls[0][0].messages[0].content;
		expect(calledContent.length).toBe(20_000);
	});
});
