import assert from "node:assert/strict";
import type { Article } from "../article.types";
import { markSummaryReady } from "./mark-summary-ready";

function buildArticle(overrides: Partial<Article> = {}): Article {
	return {
		url: "https://example.com/article",
		metadata: {
			title: "Title",
			siteName: "Example",
			excerpt: "Excerpt",
			wordCount: 100,
		},
		freshness: { contentFetchedAt: "2026-01-01T00:00:00.000Z" },
		estimatedReadTime: 1,
		crawl: { kind: "ready" },
		summary: { kind: "pending" },
		...overrides,
	};
}

describe("markSummaryReady", () => {
	it("flips summary to ready with the generated text and token counts", () => {
		const before = buildArticle();

		const { article } = markSummaryReady(before, {
			summary: "Generated summary body",
			excerpt: "Excerpt one-liner",
			inputTokens: 1234,
			outputTokens: 567,
		});

		assert.deepEqual(article.summary, {
			kind: "ready",
			summary: "Generated summary body",
			excerpt: "Excerpt one-liner",
			inputTokens: 1234,
			outputTokens: 567,
		});
	});

	it("declares writes for summary only so crawl state is preserved", () => {
		const before = buildArticle();

		const { writes } = markSummaryReady(before, {
			summary: "x",
			excerpt: "y",
			inputTokens: 1,
			outputTokens: 1,
		});

		assert.deepEqual([...writes], ["summary"]);
	});

	it("emits publish-summary-generated so observers see the token counts", () => {
		const before = buildArticle({ url: "https://example.com/post" });

		const { effects } = markSummaryReady(before, {
			summary: "x",
			excerpt: "y",
			inputTokens: 100,
			outputTokens: 50,
		});

		assert.deepEqual(effects, [
			{
				kind: "publish-summary-generated",
				url: "https://example.com/post",
				inputTokens: 100,
				outputTokens: 50,
			},
		]);
	});

	it("does not mutate the input article", () => {
		const before = buildArticle();
		const snapshot = JSON.parse(JSON.stringify(before));

		markSummaryReady(before, {
			summary: "x",
			excerpt: "y",
			inputTokens: 1,
			outputTokens: 1,
		});

		assert.deepEqual(before, snapshot);
	});
});
