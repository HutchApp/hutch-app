import type { Article } from "../aggregate.types";
import type { Minutes } from "../article.types";
import { recrawlTieKeptCanonical } from "./recrawl-tie-kept-canonical";

const baseArticle: Article = {
	url: "https://example.com/article",
	version: 8,
	crawl: { status: "pending" },
	summary: { status: "pending" },
	metadata: {
		title: "T",
		siteName: "example.com",
		excerpt: "E",
		wordCount: 200,
	},
	estimatedReadTime: 2 as Minutes,
};

describe("recrawlTieKeptCanonical", () => {
	it("flips crawl back to ready without touching the canonical metadata", async () => {
		const { article } = recrawlTieKeptCanonical(baseArticle);
		expect(article.crawl).toEqual({ status: "ready" });
		expect(article.metadata).toEqual(baseArticle.metadata);
		expect(article.estimatedReadTime).toBe(baseArticle.estimatedReadTime);
	});

	it("emits both the generate-summary command and recrawl-completed event", async () => {
		// Both effects MUST fire together. A future writer that resets crawl
		// to ready without emitting the GenerateSummary command would leave
		// the row in (crawl=ready, summary=pending) with no worker ever
		// picking it up — the same forever-polling reader UI that PR #271
		// fixed for refresh-article-content.
		const { effects } = recrawlTieKeptCanonical(baseArticle);
		expect(effects).toEqual([
			{ kind: "DispatchGenerateSummaryCommand", url: baseArticle.url },
			{ kind: "PublishRecrawlCompletedEvent", url: baseArticle.url },
		]);
	});

	it("preserves the summary substate (pending — the worker will populate it)", async () => {
		const { article } = recrawlTieKeptCanonical(baseArticle);
		expect(article.summary).toEqual(baseArticle.summary);
	});

	it("preserves url and version", async () => {
		const { article } = recrawlTieKeptCanonical(baseArticle);
		expect(article.url).toBe(baseArticle.url);
		expect(article.version).toBe(baseArticle.version);
	});
});
