import { initInMemoryArticleCrawl } from "./in-memory-article-crawl";

const URL = "https://example.com/article";

describe("initInMemoryArticleCrawl", () => {
	describe("markCrawlStage", () => {
		it("records the stage on a previously-pending row", async () => {
			const crawl = initInMemoryArticleCrawl();
			await crawl.markCrawlPending({ url: URL });
			await crawl.markCrawlStage({ url: URL, stage: "crawl-fetched" });

			expect(await crawl.findArticleCrawlStatus(URL)).toEqual({
				status: "pending",
				stage: "crawl-fetched",
			});
		});

		it("creates a pending+stage row when none existed", async () => {
			const crawl = initInMemoryArticleCrawl();
			await crawl.markCrawlStage({ url: URL, stage: "crawl-fetching" });

			expect(await crawl.findArticleCrawlStatus(URL)).toEqual({
				status: "pending",
				stage: "crawl-fetching",
			});
		});

		it("does not regress a row that has already gone ready", async () => {
			const crawl = initInMemoryArticleCrawl();
			await crawl.markCrawlReady({ url: URL });
			await crawl.markCrawlStage({ url: URL, stage: "crawl-content-uploaded" });

			expect(await crawl.findArticleCrawlStatus(URL)).toEqual({ status: "ready" });
		});

		it("does not regress a row that has already failed", async () => {
			const crawl = initInMemoryArticleCrawl();
			await crawl.markCrawlFailed({ url: URL, reason: "blocked" });
			await crawl.markCrawlStage({ url: URL, stage: "crawl-fetching" });

			expect(await crawl.findArticleCrawlStatus(URL)).toEqual({
				status: "failed",
				reason: "blocked",
			});
		});

		it("preserves the recorded stage when markCrawlPending is re-called (legacy-stub healing path)", async () => {
			const crawl = initInMemoryArticleCrawl();
			await crawl.markCrawlPending({ url: URL });
			await crawl.markCrawlStage({ url: URL, stage: "crawl-parsed" });
			await crawl.markCrawlPending({ url: URL });

			expect(await crawl.findArticleCrawlStatus(URL)).toEqual({
				status: "pending",
				stage: "crawl-parsed",
			});
		});
	});
});
