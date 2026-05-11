import type { Article } from "../aggregate.types";
import type { Minutes } from "../article.types";
import { markCrawlExhausted } from "./mark-crawl-exhausted";

const baseArticle: Article = {
	url: "https://example.com/article",
	version: 4,
	crawl: { status: "pending" },
	summary: { status: "pending" },
	metadata: {
		title: "T",
		siteName: "example.com",
		excerpt: "E",
		wordCount: 100,
	},
	estimatedReadTime: 1 as Minutes,
};

const params = {
	reason: "exceeded SQS maxReceiveCount",
	failedAt: "2026-05-11T00:00:00Z",
	receiveCount: 5,
};

describe("markCrawlExhausted", () => {
	it("moves a pending row to crawl=failed + summary=failed in one shot", async () => {
		// The exact regression this transition closes: the legacy DLQ handler
		// called markCrawlFailed + markSummaryFailed + publishEvent as three
		// sequential awaits. The aggregate makes the pair atomic — a partial
		// failure cannot leave (crawl=failed, summary=pending) because the
		// transition's return shape is a single Article.
		const { article } = markCrawlExhausted(baseArticle, params);
		expect(article.crawl).toEqual({
			status: "failed",
			reason: params.reason,
			failedAt: params.failedAt,
		});
		expect(article.summary).toEqual({
			status: "failed",
			reason: "crawl failed",
		});
	});

	it("emits PublishCrawlArticleFailedEvent with reason + receiveCount for canary classification", async () => {
		const { effects } = markCrawlExhausted(baseArticle, params);
		expect(effects).toEqual([
			{
				kind: "PublishCrawlArticleFailedEvent",
				url: baseArticle.url,
				reason: params.reason,
				receiveCount: params.receiveCount,
			},
		]);
	});

	it("is a no-op when crawl already reached ready (sibling tier-0 capture won the race)", async () => {
		// If the original SaveLinkCommand exceeded maxReceiveCount but a parallel
		// extension-tier capture flipped the row to ready before the DLQ
		// handler ran, the DLQ has nothing to mark — regressing the row would
		// surface a "crawl failed" UI for a perfectly readable article.
		const readyArticle: Article = {
			...baseArticle,
			crawl: { status: "ready" },
		};
		const { article, effects } = markCrawlExhausted(readyArticle, params);
		expect(article).toBe(readyArticle);
		expect(effects).toEqual([]);
	});

	it("is a no-op when crawl already reached unsupported", async () => {
		const unsupportedArticle: Article = {
			...baseArticle,
			crawl: {
				status: "unsupported",
				reason: "application/pdf",
				failedAt: "2026-05-10T00:00:00Z",
			},
		};
		const { article, effects } = markCrawlExhausted(unsupportedArticle, params);
		expect(article).toBe(unsupportedArticle);
		expect(effects).toEqual([]);
	});

	it("re-marks a previously failed row with the new reason (DLQ replay)", async () => {
		// A second DLQ delivery for the same URL gives us the chance to update
		// the reason — useful when the underlying error class changes between
		// the first and second exhaustion (e.g. timeout → IAM denial).
		const previouslyFailed: Article = {
			...baseArticle,
			crawl: {
				status: "failed",
				reason: "ETIMEDOUT",
				failedAt: "2026-05-01T00:00:00Z",
			},
		};
		const { article } = markCrawlExhausted(previouslyFailed, {
			reason: "AccessDeniedException",
			failedAt: "2026-05-11T00:00:00Z",
			receiveCount: 5,
		});
		expect(article.crawl).toEqual({
			status: "failed",
			reason: "AccessDeniedException",
			failedAt: "2026-05-11T00:00:00Z",
		});
	});
});
