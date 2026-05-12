import assert from "node:assert/strict";
import type { Article } from "../article.types";
import { markSummarySkipped } from "./mark-summary-skipped";

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

describe("markSummarySkipped", () => {
	it("flips summary to skipped with the supplied reason", () => {
		const before = buildArticle();

		const { article } = markSummarySkipped(before, { reason: "content-too-short" });

		assert.deepEqual(article.summary, {
			kind: "skipped",
			reason: "content-too-short",
		});
	});

	it("declares writes for summary only so crawl state is preserved", () => {
		const before = buildArticle();

		const { writes } = markSummarySkipped(before, { reason: "x" });

		assert.deepEqual([...writes], ["summary"]);
	});

	it("emits no effects — skipped is terminal, nothing to dispatch", () => {
		const before = buildArticle();

		const { effects } = markSummarySkipped(before, { reason: "x" });

		assert.deepEqual(effects, []);
	});

	it("leaves crawl state untouched", () => {
		const before = buildArticle({ crawl: { kind: "ready" } });

		const { article } = markSummarySkipped(before, { reason: "ai-unavailable" });

		assert.deepEqual(article.crawl, { kind: "ready" });
	});

	it("does not mutate the input article", () => {
		const before = buildArticle();
		const snapshot = JSON.parse(JSON.stringify(before));

		markSummarySkipped(before, { reason: "x" });

		assert.deepEqual(before, snapshot);
	});
});
