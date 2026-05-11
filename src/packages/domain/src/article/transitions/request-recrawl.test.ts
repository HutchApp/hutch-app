import type { Article } from "../aggregate.types";
import type { Minutes } from "../article.types";
import { requestRecrawl } from "./request-recrawl";

const baseArticle: Article = {
	url: "https://example.com/article",
	crawl: { status: "ready" },
	summary: {
		status: "ready",
		summary: "cached summary",
		excerpt: "cached excerpt",
		inputTokens: 100,
		outputTokens: 50,
	},
	metadata: {
		title: "Title",
		siteName: "example.com",
		excerpt: "Metadata excerpt",
		wordCount: 500,
	},
	estimatedReadTime: 3 as Minutes,
};

describe("requestRecrawl", () => {
	it("resets crawl AND summary to pending in the same returned article", () => {
		// The pre-aggregate /admin/recrawl wrote crawl pending, summary pending,
		// and the event in three separate calls. If any partial failure
		// occurred (e.g. summary update failed while crawl was already pending)
		// the row sat in a misleading half-recrawled state. Bundling both
		// substates into one transition makes that impossible.
		const { article } = requestRecrawl(baseArticle);
		expect(article.crawl).toEqual({ status: "pending" });
		expect(article.summary).toEqual({ status: "pending" });
	});

	it("drops the previous summary payload when resetting", () => {
		const { article } = requestRecrawl(baseArticle);
		expect(article.summary).not.toHaveProperty("summary");
		expect(article.summary).not.toHaveProperty("excerpt");
	});

	it("returns exactly one PublishRecrawlLinkInitiatedEvent for the article URL", () => {
		const { effects } = requestRecrawl(baseArticle);
		expect(effects).toEqual([
			{ kind: "PublishRecrawlLinkInitiatedEvent", url: baseArticle.url },
		]);
	});

	it("preserves metadata, freshness, and url", () => {
		const { article } = requestRecrawl(baseArticle);
		expect(article.metadata).toEqual(baseArticle.metadata);
		expect(article.estimatedReadTime).toBe(baseArticle.estimatedReadTime);
		expect(article.url).toBe(baseArticle.url);
	});

	it("resets a previously failed crawl back to pending without retaining the reason", () => {
		// Operator recrawl explicitly discards the previous failure context —
		// the run is starting from scratch.
		const failedArticle: Article = {
			...baseArticle,
			crawl: {
				status: "failed",
				reason: "ETIMEDOUT after 5 retries",
				failedAt: "2026-05-10T12:00:00Z",
			},
		};
		const { article } = requestRecrawl(failedArticle);
		expect(article.crawl).toEqual({ status: "pending" });
		expect(article.crawl).not.toHaveProperty("reason");
		expect(article.crawl).not.toHaveProperty("failedAt");
	});

	it("resets a previously unsupported crawl back to pending", () => {
		const unsupportedArticle: Article = {
			...baseArticle,
			crawl: {
				status: "unsupported",
				reason: "application/pdf",
				failedAt: "2026-05-10T12:00:00Z",
			},
		};
		const { article } = requestRecrawl(unsupportedArticle);
		expect(article.crawl).toEqual({ status: "pending" });
	});

	it("resets a skipped summary back to pending so the worker regenerates", () => {
		const skippedArticle: Article = {
			...baseArticle,
			summary: { status: "skipped", reason: "content-too-short" },
		};
		const { article } = requestRecrawl(skippedArticle);
		expect(article.summary).toEqual({ status: "pending" });
	});
});
