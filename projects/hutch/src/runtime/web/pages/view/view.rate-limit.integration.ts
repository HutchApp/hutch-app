import request from "supertest";
import { createTestApp } from "../../../test-app";

import { initInMemoryArticleCrawl } from "../../../providers/article-crawl/in-memory-article-crawl";
import { initInMemoryArticleStore } from "../../../providers/article-store/in-memory-article-store";
import {
	TEST_APP_ORIGIN,
	createFakeApplyParseResult,
	createFakePublishLinkSaved,
	createFakeSummaryProvider,
	createInMemoryPublishUpdateFetchTimestamp,
	createNoopLogError,
	createNoopRefreshArticleIfStale,
	defaultHttpErrorMessageMapping,
	initReadabilityParser,
	stubCrawlArticle,
} from "../../../test-app-fakes";

const ARTICLE_URL = "https://example.com/post";
const ENCODED = encodeURIComponent(ARTICLE_URL);

describe("View article rate limit", () => {
	let nowMock: jest.SpyInstance<number, []>;

	beforeEach(() => {
		nowMock = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
	});

	afterEach(() => {
		nowMock.mockRestore();
	});

	it("blocks the 21st request in a 10s window and resets after the window slides", async () => {
		const articleStore = initInMemoryArticleStore();
		const articleCrawl = initInMemoryArticleCrawl();
		const crawlArticle = stubCrawlArticle;
		const { parseArticle } = initReadabilityParser({ crawlArticle, sitePreParsers: [], logError: createNoopLogError() });
		const applyParseResult = createFakeApplyParseResult({ articleStore: articleStore, articleCrawl: articleCrawl, parseArticle });
		const summary = createFakeSummaryProvider();
		const { app } = createTestApp({
			articleStore,
			articleCrawl,
			parseArticle,
			crawlArticle,
			publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
			publishSaveAnonymousLink: async () => {},
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

		for (let i = 0; i < 20; i++) {
			expect((await request(app).get(`/view/${ENCODED}`)).status).toBe(200);
		}

		const blocked = await request(app).get(`/view/${ENCODED}`);
		expect(blocked.status).toBe(429);
		expect(blocked.text).toBe("");

		nowMock.mockReturnValue(1_000_000 + 10_001);

		expect((await request(app).get(`/view/${ENCODED}`)).status).toBe(200);
	});

	it("tracks each URL in its own counter (per-URL isolation)", async () => {
		const articleStore = initInMemoryArticleStore();
		const articleCrawl = initInMemoryArticleCrawl();
		const crawlArticle = stubCrawlArticle;
		const { parseArticle } = initReadabilityParser({ crawlArticle, sitePreParsers: [], logError: createNoopLogError() });
		const applyParseResult = createFakeApplyParseResult({ articleStore: articleStore, articleCrawl: articleCrawl, parseArticle });
		const summary = createFakeSummaryProvider();
		const { app } = createTestApp({
			articleStore,
			articleCrawl,
			parseArticle,
			crawlArticle,
			publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
			publishSaveAnonymousLink: async () => {},
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
		const urlA = encodeURIComponent("https://example.com/a");
		const urlB = encodeURIComponent("https://example.com/b");

		for (let i = 0; i < 20; i++) {
			expect((await request(app).get(`/view/${urlA}`)).status).toBe(200);
		}
		expect((await request(app).get(`/view/${urlA}`)).status).toBe(429);
		expect((await request(app).get(`/view/${urlB}`)).status).toBe(200);
	});
});
