import type { Article } from "../aggregate.types";
import type { Minutes } from "../article.types";
import { refreshContent } from "./refresh-content";

const baseArticle: Article = {
	url: "https://example.com/article",
	crawl: { status: "ready" },
	summary: {
		status: "ready",
		summary: "old summary",
		excerpt: "old excerpt",
		inputTokens: 100,
		outputTokens: 50,
	},
	metadata: {
		title: "Old title",
		siteName: "example.com",
		excerpt: "old metadata excerpt",
		wordCount: 500,
	},
	estimatedReadTime: 3 as Minutes,
	contentFetchedAt: "2026-04-01T00:00:00Z",
	etag: '"old-etag"',
	lastModified: "Mon, 01 Apr 2026 00:00:00 GMT",
};

const refreshParams = {
	metadata: {
		title: "New title",
		siteName: "example.com",
		excerpt: "new metadata excerpt",
		wordCount: 600,
		imageUrl: "https://cdn.example.com/img.png",
	},
	estimatedReadTime: 4 as Minutes,
	contentFetchedAt: "2026-05-11T00:00:00Z",
	etag: '"new-etag"',
	lastModified: "Mon, 11 May 2026 00:00:00 GMT",
};

describe("refreshContent", () => {
	it("writes the new metadata atomically with summary.status=pending", () => {
		const { article } = refreshContent(baseArticle, refreshParams);

		expect(article.metadata).toEqual(refreshParams.metadata);
		expect(article.estimatedReadTime).toBe(refreshParams.estimatedReadTime);
		expect(article.contentFetchedAt).toBe(refreshParams.contentFetchedAt);
		expect(article.etag).toBe(refreshParams.etag);
		expect(article.lastModified).toBe(refreshParams.lastModified);
		expect(article.summary).toEqual({ status: "pending" });
	});

	it("drops the previous summary text + excerpt + token counts when resetting to pending", () => {
		const { article } = refreshContent(baseArticle, refreshParams);

		// The pending kind has no `summary`/`excerpt`/`inputTokens`/`outputTokens`
		// keys; the discriminated union makes carrying them in `pending` a type
		// error. This is what closes the (status=ready, summary=undefined) gap
		// — a writer that returned `{...article, summary: {status:'pending', summary: 'x'}}`
		// would not typecheck.
		expect(article.summary).not.toHaveProperty("summary");
		expect(article.summary).not.toHaveProperty("excerpt");
		expect(article.summary).not.toHaveProperty("inputTokens");
		expect(article.summary).not.toHaveProperty("outputTokens");
	});

	it("preserves the crawl substate so readers don't see a 'recrawl in progress' skeleton", () => {
		// Refresh runs after a successful crawl. Demoting `crawl.status=ready`
		// back to `pending` would surface the skeleton UI to readers for no
		// gain — the body content is still on S3.
		const { article } = refreshContent(baseArticle, refreshParams);
		expect(article.crawl).toEqual(baseArticle.crawl);
	});

	it("preserves url", () => {
		const { article } = refreshContent(baseArticle, refreshParams);
		expect(article.url).toBe(baseArticle.url);
	});

	it("returns exactly one DispatchGenerateSummaryCommand effect for the article URL", () => {
		// Why this matters: the post-Phase-1 contract is "if the transition
		// resets summary to pending, it MUST emit the command that wakes the
		// worker". A future writer that resets the summary without queueing
		// the regeneration would fail this test, surfacing the exact regression
		// PR #271 fixed at integration time — but now at unit test time.
		const { effects } = refreshContent(baseArticle, refreshParams);
		expect(effects).toEqual([
			{ kind: "DispatchGenerateSummaryCommand", url: baseArticle.url },
		]);
	});

	it("clears the optional freshness fields when the caller omits them", () => {
		const { article } = refreshContent(baseArticle, {
			...refreshParams,
			etag: undefined,
			lastModified: undefined,
		});
		expect(article.etag).toBeUndefined();
		expect(article.lastModified).toBeUndefined();
	});

	it("resets summary to pending even when the prior summary was already pending", () => {
		const pendingArticle: Article = {
			...baseArticle,
			summary: { status: "pending", stage: "summary-generating" },
		};

		const { article, effects } = refreshContent(pendingArticle, refreshParams);

		// Even when the summary is already pending, a refresh re-emits the
		// command so a stuck worker (DLQ-bound) gets a fresh shot at the new
		// content rather than the stale pre-refresh content.
		expect(article.summary).toEqual({ status: "pending" });
		expect(effects).toEqual([
			{ kind: "DispatchGenerateSummaryCommand", url: baseArticle.url },
		]);
	});
});
