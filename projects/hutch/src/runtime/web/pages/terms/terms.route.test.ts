import request from "supertest";
import { initInMemoryArticleCrawl } from "../../../providers/article-crawl/in-memory-article-crawl";
import { initInMemoryArticleStore } from "../../../providers/article-store/in-memory-article-store";
import { createTestApp } from "../../../test-app";
import {
	TEST_APP_ORIGIN,
	createFakeApplyParseResult,
	createFakePublishLinkSaved,
	createFakePublishSaveAnonymousLink,
	createFakeSummaryProvider,
	createInMemoryPublishUpdateFetchTimestamp,
	createNoopLogError,
	createNoopRefreshArticleIfStale,
	defaultHttpErrorMessageMapping,
	initReadabilityParser,
	stubCrawlArticle,
} from "../../../test-app-fakes";

describe("GET /terms", () => {
	const articleStore = initInMemoryArticleStore();
	const articleCrawl = initInMemoryArticleCrawl();
	const { parseArticle } = initReadabilityParser({ crawlArticle: stubCrawlArticle, sitePreParsers: [], logError: createNoopLogError() });
	const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle });
	const summary = createFakeSummaryProvider();
	const { app } = createTestApp({
		articleStore,
		articleCrawl,
		parseArticle,
		crawlArticle: stubCrawlArticle,
		publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
		publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
		publishUpdateFetchTimestamp: createInMemoryPublishUpdateFetchTimestamp(),
		findGeneratedSummary: summary.findGeneratedSummary,
		markSummaryPending: summary.markSummaryPending,
		findArticleCrawlStatus: articleCrawl.findArticleCrawlStatus,
		markCrawlPending: articleCrawl.markCrawlPending,
		forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
		refreshArticleIfStale: createNoopRefreshArticleIfStale(),
		httpErrorMessageMapping: defaultHttpErrorMessageMapping,
		exchangeGoogleCode: undefined,
		logError: createNoopLogError(),
		adminEmails: [],
		recrawlServiceToken: "test-service-token-abcdefghij",
		appOrigin: TEST_APP_ORIGIN,
	});

	it("should return 200 and HTML content", async () => {
		const response = await request(app).get("/terms");
		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toMatch(/text\/html/);
	});
});
