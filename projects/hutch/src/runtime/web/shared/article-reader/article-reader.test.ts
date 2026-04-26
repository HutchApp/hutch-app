import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { Minutes } from "../../../domain/article/article.types";
import type {
	ArticleCrawl,
	FindArticleCrawlStatus,
	MarkCrawlPending,
} from "../../../providers/article-crawl/article-crawl.types";
import type {
	FindGeneratedSummary,
	GeneratedSummary,
	MarkSummaryPending,
} from "../../../providers/article-summary/article-summary.types";
import type { ReadArticleContent } from "../../../providers/article-store/read-article-content";
import { initArticleReader } from "./article-reader";
import type { ArticleSnapshot, PollUrlBuilder } from "./article-reader.types";

const ARTICLE_URL = "https://example.com/post";

function makeSnapshot(): ArticleSnapshot {
	return {
		url: ARTICLE_URL,
		metadata: {
			title: "Post",
			siteName: "example.com",
			excerpt: "Excerpt.",
			wordCount: 100,
		},
		estimatedReadTime: 1 as Minutes,
	};
}

function makePollUrlBuilder(): PollUrlBuilder {
	return {
		summary: (n) => `/test/summary?poll=${n}`,
		reader: (n) => `/test/reader?poll=${n}`,
	};
}

interface FakeState {
	crawl: ArticleCrawl | undefined;
	summary: GeneratedSummary | undefined;
	content: string | undefined;
	markCrawlPendingCalls: number;
	markSummaryPendingCalls: number;
}

const FIXED_NOW = new Date("2026-04-25T12:00:00.000Z");

function initFakeDeps(initial?: Partial<FakeState>): {
	state: FakeState;
	deps: {
		findArticleCrawlStatus: FindArticleCrawlStatus;
		markCrawlPending: MarkCrawlPending;
		findGeneratedSummary: FindGeneratedSummary;
		markSummaryPending: MarkSummaryPending;
		readArticleContent: ReadArticleContent;
		now: () => Date;
	};
} {
	const state: FakeState = {
		crawl: initial?.crawl,
		summary: initial?.summary,
		content: initial?.content,
		markCrawlPendingCalls: 0,
		markSummaryPendingCalls: 0,
	};
	const deps = {
		findArticleCrawlStatus: async () => state.crawl,
		markCrawlPending: async () => {
			state.markCrawlPendingCalls += 1;
			if (state.crawl === undefined) state.crawl = { status: "pending" };
		},
		findGeneratedSummary: async () => state.summary,
		markSummaryPending: async () => {
			state.markSummaryPendingCalls += 1;
			if (state.summary === undefined) state.summary = { status: "pending" };
		},
		readArticleContent: async () => state.content,
		now: () => FIXED_NOW,
	};
	return { state, deps };
}

function parse(html: string): Document {
	return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window.document;
}

function toHtml(component: { to: (mediaType: "text/html") => { body: string } }): string {
	return component.to("text/html").body;
}

describe("initArticleReader", () => {
	describe("resolveReaderState", () => {
		it("returns content, crawl, summary and poll URLs when crawl and summary are pending", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "pending" },
				summary: { status: "pending" },
				content: undefined,
			});
			const reader = initArticleReader(deps);

			const result = await reader.resolveReaderState({
				article: makeSnapshot(),
				pollUrlBuilder: makePollUrlBuilder(),
			});

			expect(result.crawl).toEqual({ status: "pending" });
			expect(result.summary).toEqual({ status: "pending" });
			expect(result.content).toBeUndefined();
			expect(result.readerPollUrl).toBe("/test/reader?poll=1");
			expect(result.summaryPollUrl).toBe("/test/summary?poll=1");
		});

		it("populates crawlProgress with the recorded stage and its mapped percentage", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "pending", stage: "crawl-parsed" },
				summary: { status: "pending" },
			});
			const reader = initArticleReader(deps);

			const result = await reader.resolveReaderState({
				article: makeSnapshot(),
				pollUrlBuilder: makePollUrlBuilder(),
			});

			expect(result.crawlProgress).toEqual({
				stage: "crawl-parsed",
				pct: 55,
				tickAt: FIXED_NOW.toISOString(),
			});
		});

		it("defaults crawlProgress to crawl-fetching when no stage has been recorded", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "pending" },
				summary: { status: "pending" },
			});
			const reader = initArticleReader(deps);

			const result = await reader.resolveReaderState({
				article: makeSnapshot(),
				pollUrlBuilder: makePollUrlBuilder(),
			});

			expect(result.crawlProgress).toEqual({
				stage: "crawl-fetching",
				pct: 15,
				tickAt: FIXED_NOW.toISOString(),
			});
		});

		it("populates summaryProgress with the recorded stage and its mapped percentage", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "ready" },
				summary: { status: "pending", stage: "summary-generating" },
				content: "<p>body</p>",
			});
			const reader = initArticleReader(deps);

			const result = await reader.resolveReaderState({
				article: makeSnapshot(),
				pollUrlBuilder: makePollUrlBuilder(),
			});

			expect(result.summaryProgress).toEqual({
				stage: "summary-generating",
				pct: 40,
				tickAt: FIXED_NOW.toISOString(),
			});
		});

		it("omits crawlProgress when crawl is ready", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "ready" },
				summary: { status: "ready", summary: "TL;DR" },
				content: "<p>body</p>",
			});
			const reader = initArticleReader(deps);

			const result = await reader.resolveReaderState({
				article: makeSnapshot(),
				pollUrlBuilder: makePollUrlBuilder(),
			});

			expect(result.crawlProgress).toBeUndefined();
			expect(result.summaryProgress).toBeUndefined();
		});

		it("omits summaryProgress when crawl has failed (slot collapses to skipped)", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "failed", reason: "blocked" },
				summary: { status: "pending" },
			});
			const reader = initArticleReader(deps);

			const result = await reader.resolveReaderState({
				article: makeSnapshot(),
				pollUrlBuilder: makePollUrlBuilder(),
			});

			expect(result.summaryProgress).toBeUndefined();
		});

		it("omits readerPollUrl when the crawl is ready", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "ready" },
				summary: { status: "pending" },
				content: "<p>body</p>",
			});
			const reader = initArticleReader(deps);

			const result = await reader.resolveReaderState({
				article: makeSnapshot(),
				pollUrlBuilder: makePollUrlBuilder(),
			});

			expect(result.readerPollUrl).toBeUndefined();
			expect(result.content).toBe("<p>body</p>");
			expect(result.summaryPollUrl).toBe("/test/summary?poll=1");
		});

		it("omits summaryPollUrl when the summary is ready", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "ready" },
				summary: { status: "ready", summary: "TL;DR" },
				content: "<p>body</p>",
			});
			const reader = initArticleReader(deps);

			const result = await reader.resolveReaderState({
				article: makeSnapshot(),
				pollUrlBuilder: makePollUrlBuilder(),
			});

			expect(result.summaryPollUrl).toBeUndefined();
			expect(result.summary).toEqual({ status: "ready", summary: "TL;DR" });
		});

		it("omits readerPollUrl when the crawl has failed", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "failed", reason: "blocked" },
				summary: { status: "pending" },
				content: undefined,
			});
			const reader = initArticleReader(deps);

			const result = await reader.resolveReaderState({
				article: makeSnapshot(),
				pollUrlBuilder: makePollUrlBuilder(),
			});

			expect(result.readerPollUrl).toBeUndefined();
			expect(result.crawl).toEqual({ status: "failed", reason: "blocked" });
		});

		it("heals a legacy stub by re-priming both state machines when crawl and summary are both missing", async () => {
			const { state, deps } = initFakeDeps({
				crawl: undefined,
				summary: undefined,
				content: undefined,
			});
			const reader = initArticleReader(deps);

			const result = await reader.resolveReaderState({
				article: makeSnapshot(),
				pollUrlBuilder: makePollUrlBuilder(),
			});

			expect(state.markCrawlPendingCalls).toBe(1);
			expect(state.markSummaryPendingCalls).toBe(1);
			// Re-read after priming surfaces the new pending state on the same request.
			expect(result.crawl).toEqual({ status: "pending" });
			expect(result.summary).toEqual({ status: "pending" });
			expect(result.readerPollUrl).toBe("/test/reader?poll=1");
			expect(result.summaryPollUrl).toBe("/test/summary?poll=1");
		});

		it("does not re-prime when crawl is present but summary is missing", async () => {
			const { state, deps } = initFakeDeps({
				crawl: { status: "ready" },
				summary: undefined,
				content: "<p>body</p>",
			});
			const reader = initArticleReader(deps);

			await reader.resolveReaderState({
				article: makeSnapshot(),
				pollUrlBuilder: makePollUrlBuilder(),
			});

			expect(state.markCrawlPendingCalls).toBe(0);
			expect(state.markSummaryPendingCalls).toBe(0);
		});

		it("does not re-prime when summary is present but crawl is missing", async () => {
			const { state, deps } = initFakeDeps({
				crawl: undefined,
				summary: { status: "ready", summary: "TL;DR" },
				content: "<p>body</p>",
			});
			const reader = initArticleReader(deps);

			await reader.resolveReaderState({
				article: makeSnapshot(),
				pollUrlBuilder: makePollUrlBuilder(),
			});

			expect(state.markCrawlPendingCalls).toBe(0);
			expect(state.markSummaryPendingCalls).toBe(0);
		});
	});

	describe("handleSummaryPoll", () => {
		it("emits a polling slot with the next poll URL when summary is pending", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "pending" },
				summary: { status: "pending" },
			});
			const reader = initArticleReader(deps);

			const component = await reader.handleSummaryPoll({
				articleUrl: ARTICLE_URL,
				pollCount: 3,
				pollUrlBuilder: makePollUrlBuilder(),
			});

			const slot = parse(toHtml(component)).querySelector("[data-test-reader-summary]");
			assert(slot, "summary slot must be rendered");
			expect(slot.getAttribute("data-summary-status")).toBe("pending");
			expect(slot.getAttribute("hx-get")).toBe("/test/summary?poll=4");
		});

		it("emits the recorded summary stage and percentage on the polling slot", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "ready" },
				summary: { status: "pending", stage: "summary-content-loaded" },
			});
			const reader = initArticleReader(deps);

			const component = await reader.handleSummaryPoll({
				articleUrl: ARTICLE_URL,
				pollCount: 1,
				pollUrlBuilder: makePollUrlBuilder(),
			});

			const slot = parse(toHtml(component)).querySelector("[data-test-reader-summary]");
			assert(slot, "summary slot must be rendered");
			expect(slot.getAttribute("data-progress-stage")).toBe("summary-content-loaded");
			expect(slot.getAttribute("data-progress-pct")).toBe("25");
			expect(slot.getAttribute("data-progress-tick-at")).toBe(
				FIXED_NOW.toISOString(),
			);
		});

		it("stops polling at MAX_POLLS=40", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "pending" },
				summary: { status: "pending" },
			});
			const reader = initArticleReader(deps);

			const component = await reader.handleSummaryPoll({
				articleUrl: ARTICLE_URL,
				pollCount: 40,
				pollUrlBuilder: makePollUrlBuilder(),
			});

			const slot = parse(toHtml(component)).querySelector("[data-test-reader-summary]");
			assert(slot, "summary slot must be rendered");
			expect(slot.getAttribute("data-summary-status")).toBe("pending");
			expect(slot.hasAttribute("hx-get")).toBe(false);
		});

		it("renders a ready summary expanded (summaryOpen: true) and stops polling", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "ready" },
				summary: { status: "ready", summary: "TL;DR" },
			});
			const reader = initArticleReader(deps);

			const component = await reader.handleSummaryPoll({
				articleUrl: ARTICLE_URL,
				pollCount: 1,
				pollUrlBuilder: makePollUrlBuilder(),
			});

			const doc = parse(toHtml(component));
			const slot = doc.querySelector("[data-test-reader-summary]");
			assert(slot, "summary slot must be rendered");
			expect(slot.getAttribute("data-summary-status")).toBe("ready");
			const details = doc.querySelector(".article-body__summary");
			assert(details, "summary details element must be rendered");
			expect(details.hasAttribute("open")).toBe(true);
		});

		it("collapses the summary slot when the crawl has failed (no further polling)", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "failed", reason: "blocked" },
				summary: { status: "pending" },
			});
			const reader = initArticleReader(deps);

			const component = await reader.handleSummaryPoll({
				articleUrl: ARTICLE_URL,
				pollCount: 1,
				pollUrlBuilder: makePollUrlBuilder(),
			});

			const slot = parse(toHtml(component)).querySelector("[data-test-reader-summary]");
			assert(slot, "summary slot must be rendered");
			expect(slot.getAttribute("data-summary-status")).toBe("skipped");
			expect(slot.hasAttribute("hx-get")).toBe(false);
		});
	});

	describe("handleReaderPoll", () => {
		it("emits the reader slot with the next poll URL when crawl is pending", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "pending" },
				content: undefined,
			});
			const reader = initArticleReader(deps);

			const component = await reader.handleReaderPoll({
				articleUrl: ARTICLE_URL,
				pollCount: 2,
				pollUrlBuilder: makePollUrlBuilder(),
			});

			const slot = parse(toHtml(component)).querySelector("[data-test-reader-slot]");
			assert(slot, "reader slot must be rendered");
			expect(slot.getAttribute("data-reader-status")).toBe("pending");
			expect(slot.getAttribute("hx-get")).toBe("/test/reader?poll=3");
		});

		it("emits the recorded crawl stage and percentage on the polling slot", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "pending", stage: "crawl-content-uploaded" },
				content: undefined,
			});
			const reader = initArticleReader(deps);

			const component = await reader.handleReaderPoll({
				articleUrl: ARTICLE_URL,
				pollCount: 1,
				pollUrlBuilder: makePollUrlBuilder(),
			});

			const slot = parse(toHtml(component)).querySelector("[data-test-reader-slot]");
			assert(slot, "reader slot must be rendered");
			expect(slot.getAttribute("data-progress-stage")).toBe("crawl-content-uploaded");
			expect(slot.getAttribute("data-progress-pct")).toBe("90");
			expect(slot.getAttribute("data-progress-tick-at")).toBe(
				FIXED_NOW.toISOString(),
			);
		});

		it("stops polling at MAX_POLLS=40", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "pending" },
			});
			const reader = initArticleReader(deps);

			const component = await reader.handleReaderPoll({
				articleUrl: ARTICLE_URL,
				pollCount: 40,
				pollUrlBuilder: makePollUrlBuilder(),
			});

			const slot = parse(toHtml(component)).querySelector("[data-test-reader-slot]");
			assert(slot, "reader slot must be rendered");
			expect(slot.getAttribute("data-reader-status")).toBe("pending");
			expect(slot.hasAttribute("hx-get")).toBe(false);
		});

		it("renders the ready reader with content when the crawl is ready", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "ready" },
				content: "<article><p>Body</p></article>",
			});
			const reader = initArticleReader(deps);

			const component = await reader.handleReaderPoll({
				articleUrl: ARTICLE_URL,
				pollCount: 1,
				pollUrlBuilder: makePollUrlBuilder(),
			});

			const slot = parse(toHtml(component)).querySelector("[data-test-reader-slot]");
			assert(slot, "reader slot must be rendered");
			expect(slot.getAttribute("data-reader-status")).toBe("ready");
			expect(slot.hasAttribute("hx-get")).toBe(false);
		});

		it("renders the reader as failed when the crawl has failed", async () => {
			const { deps } = initFakeDeps({
				crawl: { status: "failed", reason: "blocked" },
			});
			const reader = initArticleReader(deps);

			const component = await reader.handleReaderPoll({
				articleUrl: ARTICLE_URL,
				pollCount: 1,
				pollUrlBuilder: makePollUrlBuilder(),
			});

			const slot = parse(toHtml(component)).querySelector("[data-test-reader-slot]");
			assert(slot, "reader slot must be rendered");
			expect(slot.getAttribute("data-reader-status")).toBe("failed");
		});
	});
});
