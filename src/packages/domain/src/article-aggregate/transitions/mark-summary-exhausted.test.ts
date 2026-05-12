import assert from "node:assert/strict";
import type { Article } from "../article.types";
import { markSummaryExhausted } from "./mark-summary-exhausted";

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

describe("markSummaryExhausted", () => {
	it("flips summary to failed with the supplied reason", () => {
		const before = buildArticle();

		const { article } = markSummaryExhausted(before, {
			reason: "exceeded SQS maxReceiveCount",
			receiveCount: 6,
		});

		assert.deepEqual(article.summary, {
			kind: "failed",
			reason: "exceeded SQS maxReceiveCount",
		});
	});

	it("declares writes for summary only — a failed summary does not invalidate the article body", () => {
		const before = buildArticle();

		const { writes } = markSummaryExhausted(before, {
			reason: "x",
			receiveCount: 1,
		});

		assert.deepEqual([...writes], ["summary"]);
	});

	it("emits publish-summary-generation-failed so the parse-error stream records the terminal state", () => {
		const before = buildArticle({ url: "https://example.com/post" });

		const { effects } = markSummaryExhausted(before, {
			reason: "deepseek 503",
			receiveCount: 6,
		});

		assert.deepEqual(effects, [
			{
				kind: "publish-summary-generation-failed",
				url: "https://example.com/post",
				reason: "deepseek 503",
				receiveCount: 6,
			},
		]);
	});

	it("leaves crawl axis untouched", () => {
		const before = buildArticle({ crawl: { kind: "ready" } });

		const { article } = markSummaryExhausted(before, {
			reason: "x",
			receiveCount: 1,
		});

		assert.deepEqual(article.crawl, { kind: "ready" });
	});

	it("does not mutate the input article", () => {
		const before = buildArticle();
		const snapshot = JSON.parse(JSON.stringify(before));

		markSummaryExhausted(before, { reason: "x", receiveCount: 1 });

		assert.deepEqual(before, snapshot);
	});
});
