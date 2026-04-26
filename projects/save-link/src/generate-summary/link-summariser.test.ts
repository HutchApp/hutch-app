import { noopLogger } from "@packages/hutch-logger";
import { initLinkSummariser } from "./link-summariser";
import type {
	CreateAiMessage,
	FindGeneratedSummary,
	MarkSummarySkipped,
	MarkSummaryStage,
	SaveGeneratedSummary,
} from "./article-summary.types";

function createStubCreateMessage(summary: string): CreateAiMessage {
	return async () => ({
		content: [{ type: "text", text: JSON.stringify({ summary }) }],
		usage: { input_tokens: 50, output_tokens: 10 },
	});
}

const noCache: FindGeneratedSummary = async () => undefined;
const pendingCache: FindGeneratedSummary = async () => ({ status: "pending" });
const noopSave: SaveGeneratedSummary = async () => {};
const noopMarkSkipped: MarkSummarySkipped = async () => {};
const noopMarkStage: MarkSummaryStage = async () => {};
const identity = (text: string) => text;

describe("initLinkSummariser", () => {
	it("should skip summarisation and mark the row as skipped when isTooShortToSummarize returns true", async () => {
		const createMessage = jest.fn();
		const markSummarySkipped = jest.fn().mockResolvedValue(undefined);

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			findGeneratedSummary: pendingCache,
			saveGeneratedSummary: noopSave,
			markSummarySkipped,
			markSummaryStage: noopMarkStage,
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
		expect(markSummarySkipped).toHaveBeenCalledWith({ url: "https://example.com/short" });
	});

	it("should pass article content as a document block to createMessage", async () => {
		const createMessage = jest.fn().mockResolvedValue({
			content: [{ type: "text", text: JSON.stringify({ summary: "A summary." }) }],
			usage: { input_tokens: 50, output_tokens: 10 },
		});

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			findGeneratedSummary: noCache,
			saveGeneratedSummary: noopSave,
			markSummarySkipped: noopMarkSkipped,
			markSummaryStage: noopMarkStage,
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
			findGeneratedSummary: pendingCache,
			saveGeneratedSummary: noopSave,
			markSummarySkipped: noopMarkSkipped,
			markSummaryStage: noopMarkStage,
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

	it("should return null on ready cache hit without calling createMessage", async () => {
		const createMessage = jest.fn();
		const cachedSummary: FindGeneratedSummary = async () => ({
			status: "ready",
			summary: "cached summary",
		});

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			findGeneratedSummary: cachedSummary,
			saveGeneratedSummary: noopSave,
			markSummarySkipped: noopMarkSkipped,
			markSummaryStage: noopMarkStage,
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

	it("should return null on skipped cache hit", async () => {
		const createMessage = jest.fn();
		const skippedCache: FindGeneratedSummary = async () => ({ status: "skipped" });

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			findGeneratedSummary: skippedCache,
			saveGeneratedSummary: noopSave,
			markSummarySkipped: noopMarkSkipped,
			markSummaryStage: noopMarkStage,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => false,
		});

		const result = await summarizeArticle({
			url: "https://example.com/skipped",
			textContent: "Some content.",
		});

		expect(result).toBeNull();
		expect(createMessage).not.toHaveBeenCalled();
	});

	it("should retry on failed status (redrive scenario: give the new attempt a chance)", async () => {
		const createMessage = createStubCreateMessage("Recovered summary.");
		const failedCache: FindGeneratedSummary = async () => ({
			status: "failed",
			reason: "timeout",
		});

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			findGeneratedSummary: failedCache,
			saveGeneratedSummary: noopSave,
			markSummarySkipped: noopMarkSkipped,
			markSummaryStage: noopMarkStage,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => false,
		});

		const result = await summarizeArticle({
			url: "https://example.com/failed",
			textContent: "Some content.",
		});

		expect(result).toEqual({
			summary: "Recovered summary.",
			inputTokens: 50,
			outputTokens: 10,
		});
	});

	it("should proceed when cache status is pending", async () => {
		const createMessage = createStubCreateMessage("Fresh summary.");

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			findGeneratedSummary: pendingCache,
			saveGeneratedSummary: noopSave,
			markSummarySkipped: noopMarkSkipped,
			markSummaryStage: noopMarkStage,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => false,
		});

		const result = await summarizeArticle({
			url: "https://example.com/pending",
			textContent: "Long content.",
		});

		expect(result).toEqual({
			summary: "Fresh summary.",
			inputTokens: 50,
			outputTokens: 10,
		});
	});

	it("should return null when response has no text block", async () => {
		const createMessage: CreateAiMessage = async () => ({
			content: [{ type: "tool_use" }],
			usage: { input_tokens: 50, output_tokens: 10 },
		});

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			findGeneratedSummary: noCache,
			saveGeneratedSummary: noopSave,
			markSummarySkipped: noopMarkSkipped,
			markSummaryStage: noopMarkStage,
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

	it("emits summary progress stages in declared order on the happy path", async () => {
		const createMessage = createStubCreateMessage("A summary.");
		const markSummaryStage = jest.fn().mockResolvedValue(undefined);

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			findGeneratedSummary: noCache,
			saveGeneratedSummary: noopSave,
			markSummarySkipped: noopMarkSkipped,
			markSummaryStage,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => false,
		});

		await summarizeArticle({
			url: "https://example.com/article",
			textContent: "Long content.",
		});

		const stages = markSummaryStage.mock.calls.map((call) => call[0].stage);
		expect(stages).toEqual([
			"summary-started",
			"summary-content-loaded",
			"summary-generating",
			"summary-complete",
		]);
	});

	it("emits only summary-started before terminating when content is too short", async () => {
		const markSummaryStage = jest.fn().mockResolvedValue(undefined);

		const { summarizeArticle } = initLinkSummariser({
			createMessage: jest.fn(),
			findGeneratedSummary: pendingCache,
			saveGeneratedSummary: noopSave,
			markSummarySkipped: noopMarkSkipped,
			markSummaryStage,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => true,
		});

		await summarizeArticle({
			url: "https://example.com/short",
			textContent: "tiny.",
		});

		const stages = markSummaryStage.mock.calls.map((call) => call[0].stage);
		expect(stages).toEqual(["summary-started"]);
	});

	it("should return null when AI returns 'Summary not available.'", async () => {
		const createMessage = createStubCreateMessage("Summary not available.");

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			findGeneratedSummary: noCache,
			saveGeneratedSummary: noopSave,
			markSummarySkipped: noopMarkSkipped,
			markSummaryStage: noopMarkStage,
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
