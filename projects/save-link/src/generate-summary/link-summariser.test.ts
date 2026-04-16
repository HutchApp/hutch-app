import { noopLogger } from "@packages/hutch-logger";
import { initLinkSummariser } from "./link-summariser";
import type {
	CreateAiMessage,
	FindCachedSummary,
	SaveCachedSummary,
} from "./article-summary.types";

function createStubCreateMessage(summary: string): CreateAiMessage {
	return async () => ({
		content: [{ type: "text", text: JSON.stringify({ summary }) }],
		usage: { input_tokens: 50, output_tokens: 10 },
	});
}

const noCache: FindCachedSummary = async () => "";
const noopSave: SaveCachedSummary = async () => {};
const identity = (text: string) => text;

describe("initLinkSummariser", () => {
	it("should skip summarisation when isTooShortToSummarize returns true", async () => {
		const createMessage = jest.fn();

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
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
		expect(createMessage).not.toHaveBeenCalled();
	});

	it("should pass article content as a document block to createMessage", async () => {
		const createMessage = jest.fn().mockResolvedValue({
			content: [{ type: "text", text: JSON.stringify({ summary: "A summary." }) }],
			usage: { input_tokens: 50, output_tokens: 10 },
		});

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			findCachedSummary: noCache,
			saveCachedSummary: noopSave,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => false,
		});

		await summarizeArticle({
			url: "https://example.com/article",
			textContent: "Some article content about prompt injection.",
		});

		expect(createMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [{
					role: "user",
					content: [{
						type: "document",
						source: { type: "text", media_type: "text/plain", data: "Some article content about prompt injection." },
						title: "Article to summarize",
						citations: { enabled: true },
					}],
				}],
			}),
		);
	});

	it("should call createMessage when isTooShortToSummarize returns false", async () => {
		const createMessage = createStubCreateMessage("A good summary.");

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
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

	it("should return null on cache hit without calling createMessage", async () => {
		const createMessage = jest.fn();
		const cachedSummary: FindCachedSummary = async () => "cached summary";

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
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
		expect(createMessage).not.toHaveBeenCalled();
	});

	it("should return null when response has no text block", async () => {
		const createMessage: CreateAiMessage = async () => ({
			content: [{ type: "tool_use" }],
			usage: { input_tokens: 50, output_tokens: 10 },
		});

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			findCachedSummary: noCache,
			saveCachedSummary: noopSave,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => false,
		});

		const result = await summarizeArticle({
			url: "https://example.com/no-text-block",
			textContent: "Some article content.",
		});

		expect(result).toBeNull();
	});

	it("should return null when AI returns 'Summary not available.'", async () => {
		const createMessage = createStubCreateMessage("Summary not available.");

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
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
