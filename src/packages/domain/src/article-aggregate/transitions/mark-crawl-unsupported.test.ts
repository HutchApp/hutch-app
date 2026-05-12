import assert from "node:assert/strict";
import type { Article } from "../article.types";
import { markCrawlUnsupported } from "./mark-crawl-unsupported";

function buildArticle(overrides: Partial<Article> = {}): Article {
	return {
		url: "https://example.com/file.pdf",
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

describe("markCrawlUnsupported", () => {
	it("flips crawl to unsupported with the supplied reason", () => {
		const before = buildArticle();

		const { article } = markCrawlUnsupported(before, { reason: "application/pdf" });

		assert.deepEqual(article.crawl, {
			kind: "unsupported",
			reason: "application/pdf",
		});
	});

	it("skips the summary so the canary does not keep flagging the row as pending", () => {
		const before = buildArticle();

		const { article } = markCrawlUnsupported(before, { reason: "image/png" });

		assert.deepEqual(article.summary, {
			kind: "skipped",
			reason: "crawl-unsupported",
		});
	});

	it("declares writes for crawl and summary so both axes flip atomically with one DDB update", () => {
		const before = buildArticle();

		const { writes } = markCrawlUnsupported(before, { reason: "x" });

		assert.deepEqual([...writes].sort(), ["crawl", "summary"]);
	});

	it("emits no effects — terminal state, nothing downstream to wake up", () => {
		const before = buildArticle();

		const { effects } = markCrawlUnsupported(before, { reason: "x" });

		assert.deepEqual(effects, []);
	});

	it("does not mutate the input article", () => {
		const before = buildArticle();
		const snapshot = JSON.parse(JSON.stringify(before));

		markCrawlUnsupported(before, { reason: "x" });

		assert.deepEqual(before, snapshot);
	});
});
