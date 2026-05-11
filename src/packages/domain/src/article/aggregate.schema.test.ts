import {
	ArticleAggregateSchema,
	CrawlStateSchema,
	SummaryStateSchema,
} from "./aggregate.schema";

describe("CrawlStateSchema", () => {
	it("accepts pending with and without a stage", () => {
		expect(CrawlStateSchema.safeParse({ status: "pending" }).success).toBe(true);
		expect(
			CrawlStateSchema.safeParse({ status: "pending", stage: "crawl-fetching" })
				.success,
		).toBe(true);
	});

	it("accepts ready with no extra payload", () => {
		expect(CrawlStateSchema.safeParse({ status: "ready" }).success).toBe(true);
	});

	it("rejects failed without a reason or failedAt", () => {
		// The schema is the storage-boundary contract: a row that claims
		// failed without these fields would otherwise let the reader assert
		// at runtime (dynamodb-article-crawl.ts:41). Parsing fails first.
		expect(CrawlStateSchema.safeParse({ status: "failed" }).success).toBe(false);
		expect(
			CrawlStateSchema.safeParse({ status: "failed", reason: "x" }).success,
		).toBe(false);
		expect(
			CrawlStateSchema.safeParse({ status: "failed", failedAt: "z" }).success,
		).toBe(false);
	});

	it("accepts a fully-populated failed state", () => {
		expect(
			CrawlStateSchema.safeParse({
				status: "failed",
				reason: "ETIMEDOUT",
				failedAt: "2026-05-11T00:00:00Z",
			}).success,
		).toBe(true);
	});

	it("rejects unsupported without a reason", () => {
		expect(
			CrawlStateSchema.safeParse({
				status: "unsupported",
				failedAt: "2026-05-11T00:00:00Z",
			}).success,
		).toBe(false);
	});
});

describe("SummaryStateSchema", () => {
	it("rejects ready without summary text", () => {
		// This is the exact compile-time guard that prevents the 2026-05-10
		// "summaryStatus=ready, summary=undefined" bug from re-occurring. The
		// reader at dynamodb-generated-summary.ts:70 fails loud on this today;
		// the aggregate type makes the failure happen at the writer.
		expect(SummaryStateSchema.safeParse({ status: "ready" }).success).toBe(
			false,
		);
		expect(
			SummaryStateSchema.safeParse({
				status: "ready",
				summary: "",
				inputTokens: 1,
				outputTokens: 1,
			}).success,
		).toBe(false);
	});

	it("accepts a fully-populated ready state without excerpt", () => {
		expect(
			SummaryStateSchema.safeParse({
				status: "ready",
				summary: "Generated.",
				inputTokens: 10,
				outputTokens: 5,
			}).success,
		).toBe(true);
	});

	it("rejects failed without a reason", () => {
		expect(SummaryStateSchema.safeParse({ status: "failed" }).success).toBe(
			false,
		);
	});

	it("accepts skipped with and without a reason", () => {
		expect(SummaryStateSchema.safeParse({ status: "skipped" }).success).toBe(
			true,
		);
		expect(
			SummaryStateSchema.safeParse({
				status: "skipped",
				reason: "content-too-short",
			}).success,
		).toBe(true);
	});
});

describe("ArticleAggregateSchema", () => {
	const validRow = {
		url: "https://example.com/a",
		crawl: { status: "ready" },
		summary: {
			status: "ready",
			summary: "Generated.",
			inputTokens: 10,
			outputTokens: 5,
		},
		metadata: {
			title: "T",
			siteName: "example.com",
			excerpt: "E",
			wordCount: 100,
		},
		estimatedReadTime: 2,
	};

	it("accepts a fully-populated aggregate row", () => {
		expect(ArticleAggregateSchema.safeParse(validRow).success).toBe(true);
	});

	it("rejects an empty url", () => {
		expect(
			ArticleAggregateSchema.safeParse({ ...validRow, url: "" }).success,
		).toBe(false);
	});
});
