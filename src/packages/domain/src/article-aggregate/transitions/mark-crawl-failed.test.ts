import assert from "node:assert/strict";
import type { Article } from "../article.types";
import { markCrawlFailed } from "./mark-crawl-failed";

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
		crawl: { kind: "pending" },
		summary: { kind: "pending" },
		...overrides,
	};
}

describe("markCrawlFailed", () => {
	it("flips crawl to failed with the supplied reason", () => {
		const before = buildArticle();

		const { article } = markCrawlFailed(before, { reason: "Readability crashed" });

		assert.deepEqual(article.crawl, {
			kind: "failed",
			reason: "Readability crashed",
		});
	});

	it("declares writes for crawl only so a concurrent metadata or freshness writer is not clobbered", () => {
		const before = buildArticle();

		const { writes } = markCrawlFailed(before, { reason: "x" });

		assert.deepEqual([...writes], ["crawl"]);
	});

	it("emits no effects — DLQ exhaustion publishes the failure fact via markCrawlExhausted", () => {
		const before = buildArticle();

		const { effects } = markCrawlFailed(before, { reason: "x" });

		assert.deepEqual(effects, []);
	});

	it("does not mutate the input article", () => {
		const before = buildArticle();
		const snapshot = JSON.parse(JSON.stringify(before));

		markCrawlFailed(before, { reason: "x" });

		assert.deepEqual(before, snapshot);
	});

	it("leaves summary state untouched so a previously skipped or ready summary is not regressed", () => {
		const before = buildArticle({
			summary: { kind: "ready", summary: "still useful", excerpt: "x" },
		});

		const { article } = markCrawlFailed(before, { reason: "parse error" });

		assert.deepEqual(article.summary, before.summary);
	});
});
