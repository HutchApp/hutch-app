import { noopLogger } from "@packages/hutch-logger";
import { initLinkSummariser } from "./link-summariser";
import type { CreateAiMessage } from "./create-ai-message.types";
import type { MarkSummaryStage } from "./mark-summary-stage";

function createStubCreateMessage(payload: {
	summary: string;
	excerpt: string;
}): CreateAiMessage {
	return async () => ({
		content: [{ type: "text", text: JSON.stringify(payload) }],
		usage: { input_tokens: 50, output_tokens: 10 },
	});
}

const noopMarkStage: MarkSummaryStage = async () => {};
const identity = (text: string) => text;

describe("initLinkSummariser", () => {
	it("returns {kind: skipped, reason: content-too-short} when isTooShortToSummarize returns true and never calls the AI", async () => {
		const createMessage = jest.fn();

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			markSummaryStage: noopMarkStage,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => true,
		});

		const result = await summarizeArticle({
			url: "https://example.com/short",
			textContent: "Short article text.",
		});

		expect(result).toEqual({ kind: "skipped", reason: "content-too-short" });
		expect(createMessage).not.toHaveBeenCalled();
	});

	it("passes article content as a document block to createMessage", async () => {
		const createMessage = jest.fn().mockResolvedValue({
			content: [
				{
					type: "text",
					text: JSON.stringify({ summary: "A summary.", excerpt: "Blurb." }),
				},
			],
			usage: { input_tokens: 50, output_tokens: 10 },
		});

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
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
				messages: [
					{
						role: "user",
						content: [
							{
								type: "document",
								source: {
									type: "text",
									media_type: "text/plain",
									data: "Some article content about prompt injection.",
								},
								title: "Article to summarize",
								citations: { enabled: true },
							},
						],
					},
				],
			}),
		);
	});

	it("returns {kind: ready, summary, excerpt, tokens} on a successful AI response", async () => {
		const createMessage = createStubCreateMessage({
			summary: "A good summary.",
			excerpt: "Quick blurb.",
		});

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
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
			kind: "ready",
			summary: "A good summary.",
			excerpt: "Quick blurb.",
			inputTokens: 50,
			outputTokens: 10,
		});
	});

	it("clips an over-length excerpt at the last word boundary", async () => {
		const overLong = `${"word ".repeat(60)}tail`;
		const createMessage = createStubCreateMessage({
			summary: "Body.",
			excerpt: overLong,
		});

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			markSummaryStage: noopMarkStage,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => false,
		});

		const result = await summarizeArticle({
			url: "https://example.com/long",
			textContent: "x",
		});

		expect(result.kind).toBe("ready");
		if (result.kind !== "ready") return;
		expect(result.excerpt.length).toBeLessThanOrEqual(160);
		expect(result.excerpt.endsWith("…")).toBe(true);
	});

	it("hard-cuts an over-length excerpt that has no whitespace", async () => {
		const noSpaces = "x".repeat(200);
		const createMessage = createStubCreateMessage({
			summary: "Body.",
			excerpt: noSpaces,
		});

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			markSummaryStage: noopMarkStage,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => false,
		});

		const result = await summarizeArticle({
			url: "https://example.com/no-spaces",
			textContent: "x",
		});

		expect(result.kind).toBe("ready");
		if (result.kind !== "ready") return;
		expect(result.excerpt).toBe(`${"x".repeat(159)}…`);
	});

	it("returns {kind: no-text-block} when the AI response has no text block", async () => {
		const createMessage: CreateAiMessage = async () => ({
			content: [{ type: "tool_use" }],
			usage: { input_tokens: 50, output_tokens: 10 },
		});

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			markSummaryStage: noopMarkStage,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => false,
		});

		const result = await summarizeArticle({
			url: "https://example.com/no-text-block",
			textContent: "Some article content.",
		});

		expect(result).toEqual({ kind: "no-text-block" });
	});

	it("returns {kind: skipped, reason: ai-unavailable} when the AI returns 'Summary not available.'", async () => {
		const createMessage = createStubCreateMessage({
			summary: "Summary not available.",
			excerpt: "Summary not available.",
		});

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			markSummaryStage: noopMarkStage,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => false,
		});

		const result = await summarizeArticle({
			url: "https://example.com/unavailable",
			textContent: "Content that cannot be summarised.",
		});

		expect(result).toEqual({ kind: "skipped", reason: "ai-unavailable" });
	});

	it("writes summary-started and summary-generating stages while running", async () => {
		const markSummaryStage = jest.fn().mockResolvedValue(undefined);
		const createMessage = createStubCreateMessage({
			summary: "Body.",
			excerpt: "Excerpt.",
		});

		const { summarizeArticle } = initLinkSummariser({
			createMessage,
			markSummaryStage,
			logger: noopLogger,
			cleanContent: identity,
			isTooShortToSummarize: () => false,
		});

		await summarizeArticle({
			url: "https://example.com/article",
			textContent: "Content.",
		});

		expect(markSummaryStage).toHaveBeenNthCalledWith(1, {
			url: "https://example.com/article",
			stage: "summary-started",
		});
		expect(markSummaryStage).toHaveBeenNthCalledWith(2, {
			url: "https://example.com/article",
			stage: "summary-generating",
		});
	});
});
