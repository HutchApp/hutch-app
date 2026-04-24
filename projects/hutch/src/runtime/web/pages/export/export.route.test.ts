import { JSDOM } from "jsdom";
import request from "supertest";
import type { Minutes } from "../../../domain/article/article.types";
import type { UserId } from "../../../domain/user/user.types";
import { fetchAllArticles } from "./export.page";
import { initInMemoryArticleStore } from "../../../providers/article-store/in-memory-article-store";
import { createTestApp } from "../../../test-app";

import { initInMemoryArticleCrawl } from "../../../providers/article-crawl/in-memory-article-crawl";
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

async function loginAgent(
	app: ReturnType<typeof createTestApp>["app"],
	auth: ReturnType<typeof createTestApp>["auth"],
) {
	await auth.createUser({ email: "test@example.com", password: "password123" });
	const agent = request.agent(app);
	await agent
		.post("/login")
		.type("form")
		.send({ email: "test@example.com", password: "password123" });
	return agent;
}

describe("Export routes", () => {
	describe("GET /export (unauthenticated)", () => {
		it("should redirect to /login", async () => {
			const articleStore = initInMemoryArticleStore();
			const articleCrawl = initInMemoryArticleCrawl();
			const crawlArticle = stubCrawlArticle;
			const { parseArticle } = initReadabilityParser({ crawlArticle, sitePreParsers: [], logError: createNoopLogError() });
			const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle });
			const summary = createFakeSummaryProvider();
			const { app } = createTestApp({
				articleStore,
				articleCrawl,
				parseArticle,
				crawlArticle,
				publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
				publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
				publishUpdateFetchTimestamp: createInMemoryPublishUpdateFetchTimestamp(),
				findGeneratedSummary: summary.findGeneratedSummary,
				markSummaryPending: summary.markSummaryPending,
				findArticleCrawlStatus: articleCrawl.findArticleCrawlStatus,
				markCrawlPending: articleCrawl.markCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				appOrigin: TEST_APP_ORIGIN,
			});
			const response = await request(app).get("/export");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/login");
		});
	});

	describe("GET /export (authenticated)", () => {
		it("should render the export page", async () => {
			const articleStore = initInMemoryArticleStore();
			const articleCrawl = initInMemoryArticleCrawl();
			const crawlArticle = stubCrawlArticle;
			const { parseArticle } = initReadabilityParser({ crawlArticle, sitePreParsers: [], logError: createNoopLogError() });
			const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle });
			const summary = createFakeSummaryProvider();
			const { app, auth } = createTestApp({
				articleStore,
				articleCrawl,
				parseArticle,
				crawlArticle,
				publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
				publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
				publishUpdateFetchTimestamp: createInMemoryPublishUpdateFetchTimestamp(),
				findGeneratedSummary: summary.findGeneratedSummary,
				markSummaryPending: summary.markSummaryPending,
				findArticleCrawlStatus: articleCrawl.findArticleCrawlStatus,
				markCrawlPending: articleCrawl.markCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				appOrigin: TEST_APP_ORIGIN,
			});
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/export");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("h1")?.textContent).toContain(
				"Export Your Data",
			);
			expect(
				doc
					.querySelector("[data-test-export-download]")
					?.getAttribute("href"),
			).toBe("/export/download");
		});
	});

	describe("GET /export/download (unauthenticated)", () => {
		it("should redirect to /login", async () => {
			const articleStore = initInMemoryArticleStore();
			const articleCrawl = initInMemoryArticleCrawl();
			const crawlArticle = stubCrawlArticle;
			const { parseArticle } = initReadabilityParser({ crawlArticle, sitePreParsers: [], logError: createNoopLogError() });
			const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle });
			const summary = createFakeSummaryProvider();
			const { app } = createTestApp({
				articleStore,
				articleCrawl,
				parseArticle,
				crawlArticle,
				publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
				publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
				publishUpdateFetchTimestamp: createInMemoryPublishUpdateFetchTimestamp(),
				findGeneratedSummary: summary.findGeneratedSummary,
				markSummaryPending: summary.markSummaryPending,
				findArticleCrawlStatus: articleCrawl.findArticleCrawlStatus,
				markCrawlPending: articleCrawl.markCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				appOrigin: TEST_APP_ORIGIN,
			});
			const response = await request(app).get("/export/download");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/login");
		});
	});

	describe("GET /export/download (authenticated)", () => {
		it("should return JSON file with content-disposition header", async () => {
			const articleStore = initInMemoryArticleStore();
			const articleCrawl = initInMemoryArticleCrawl();
			const crawlArticle = stubCrawlArticle;
			const { parseArticle } = initReadabilityParser({ crawlArticle, sitePreParsers: [], logError: createNoopLogError() });
			const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle });
			const summary = createFakeSummaryProvider();
			const { app, auth } = createTestApp({
				articleStore,
				articleCrawl,
				parseArticle,
				crawlArticle,
				publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
				publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
				publishUpdateFetchTimestamp: createInMemoryPublishUpdateFetchTimestamp(),
				findGeneratedSummary: summary.findGeneratedSummary,
				markSummaryPending: summary.markSummaryPending,
				findArticleCrawlStatus: articleCrawl.findArticleCrawlStatus,
				markCrawlPending: articleCrawl.markCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				appOrigin: TEST_APP_ORIGIN,
			});
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/export/download");

			expect(response.status).toBe(200);
			expect(response.headers["content-type"]).toContain(
				"application/json",
			);
			expect(response.headers["content-disposition"]).toMatch(
				/^attachment; filename="readplace-export-\d{4}-\d{2}-\d{2}\.json"$/,
			);
		});

		it("should return empty articles array when user has no articles", async () => {
			const articleStore = initInMemoryArticleStore();
			const articleCrawl = initInMemoryArticleCrawl();
			const crawlArticle = stubCrawlArticle;
			const { parseArticle } = initReadabilityParser({ crawlArticle, sitePreParsers: [], logError: createNoopLogError() });
			const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle });
			const summary = createFakeSummaryProvider();
			const { app, auth } = createTestApp({
				articleStore,
				articleCrawl,
				parseArticle,
				crawlArticle,
				publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
				publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
				publishUpdateFetchTimestamp: createInMemoryPublishUpdateFetchTimestamp(),
				findGeneratedSummary: summary.findGeneratedSummary,
				markSummaryPending: summary.markSummaryPending,
				findArticleCrawlStatus: articleCrawl.findArticleCrawlStatus,
				markCrawlPending: articleCrawl.markCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				appOrigin: TEST_APP_ORIGIN,
			});
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/export/download");
			const data = JSON.parse(response.text);

			expect(data.articleCount).toBe(0);
			expect(data.articles).toEqual([]);
			expect(Number.isFinite(new Date(data.exportedAt).getTime())).toBe(true);
		});

		it("should include all saved articles in the export", async () => {
			const articleStore = initInMemoryArticleStore();
			const articleCrawl = initInMemoryArticleCrawl();
			const crawlArticle = stubCrawlArticle;
			const { parseArticle } = initReadabilityParser({ crawlArticle, sitePreParsers: [], logError: createNoopLogError() });
			const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle });
			const summary = createFakeSummaryProvider();
			const { app, auth } = createTestApp({
				articleStore,
				articleCrawl,
				parseArticle,
				crawlArticle,
				publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
				publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
				publishUpdateFetchTimestamp: createInMemoryPublishUpdateFetchTimestamp(),
				findGeneratedSummary: summary.findGeneratedSummary,
				markSummaryPending: summary.markSummaryPending,
				findArticleCrawlStatus: articleCrawl.findArticleCrawlStatus,
				markCrawlPending: articleCrawl.markCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				appOrigin: TEST_APP_ORIGIN,
			});
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article-1" });
			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article-2" });

			const response = await agent.get("/export/download");
			const data = JSON.parse(response.text);

			expect(data.articleCount).toBe(2);
			expect(data.articles).toHaveLength(2);
		});

		it("should export article fields correctly", async () => {
			const articleStore = initInMemoryArticleStore();
			const articleCrawl = initInMemoryArticleCrawl();
			const crawlArticle = stubCrawlArticle;
			const { parseArticle } = initReadabilityParser({ crawlArticle, sitePreParsers: [], logError: createNoopLogError() });
			const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle });
			const summary = createFakeSummaryProvider();
			const { app, auth } = createTestApp({
				articleStore,
				articleCrawl,
				parseArticle,
				crawlArticle,
				publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
				publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
				publishUpdateFetchTimestamp: createInMemoryPublishUpdateFetchTimestamp(),
				findGeneratedSummary: summary.findGeneratedSummary,
				markSummaryPending: summary.markSummaryPending,
				findArticleCrawlStatus: articleCrawl.findArticleCrawlStatus,
				markCrawlPending: articleCrawl.markCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				appOrigin: TEST_APP_ORIGIN,
			});
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const response = await agent.get("/export/download");
			const data = JSON.parse(response.text);
			const article = data.articles[0];

			expect(article.url).toBe("https://example.com/article");
			expect(typeof article.title).toBe("string");
			expect(typeof article.siteName).toBe("string");
			expect(article.status).toBe("unread");
			expect(Number.isFinite(new Date(article.savedAt).getTime())).toBe(true);
			expect(article.readAt).toBeNull();
			expect(typeof article.wordCount).toBe("number");
			expect(typeof article.estimatedReadTimeMinutes).toBe("number");
		});

		it("should not include articles from other users", async () => {
			const articleStore = initInMemoryArticleStore();
			const articleCrawl = initInMemoryArticleCrawl();
			const crawlArticle = stubCrawlArticle;
			const { parseArticle } = initReadabilityParser({ crawlArticle, sitePreParsers: [], logError: createNoopLogError() });
			const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle });
			const summary = createFakeSummaryProvider();
			const { app, auth } = createTestApp({
				articleStore,
				articleCrawl,
				parseArticle,
				crawlArticle,
				publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
				publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
				publishUpdateFetchTimestamp: createInMemoryPublishUpdateFetchTimestamp(),
				findGeneratedSummary: summary.findGeneratedSummary,
				markSummaryPending: summary.markSummaryPending,
				findArticleCrawlStatus: articleCrawl.findArticleCrawlStatus,
				markCrawlPending: articleCrawl.markCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				appOrigin: TEST_APP_ORIGIN,
			});

			await auth.createUser({
				email: "user1@example.com",
				password: "password123",
			});
			await auth.createUser({
				email: "user2@example.com",
				password: "password123",
			});

			const agent1 = request.agent(app);
			await agent1
				.post("/login")
				.type("form")
				.send({ email: "user1@example.com", password: "password123" });
			await agent1
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/user1-article" });

			const agent2 = request.agent(app);
			await agent2
				.post("/login")
				.type("form")
				.send({ email: "user2@example.com", password: "password123" });
			await agent2
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/user2-article" });

			const response = await agent1.get("/export/download");
			const data = JSON.parse(response.text);

			expect(data.articleCount).toBe(1);
			expect(data.articles[0].url).toBe(
				"https://example.com/user1-article",
			);
		});

		it("should include articles of all statuses", async () => {
			const articleStore = initInMemoryArticleStore();
			const articleCrawl = initInMemoryArticleCrawl();
			const crawlArticle = stubCrawlArticle;
			const { parseArticle } = initReadabilityParser({ crawlArticle, sitePreParsers: [], logError: createNoopLogError() });
			const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle });
			const summary = createFakeSummaryProvider();
			const { app, auth } = createTestApp({
				articleStore,
				articleCrawl,
				parseArticle,
				crawlArticle,
				publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
				publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
				publishUpdateFetchTimestamp: createInMemoryPublishUpdateFetchTimestamp(),
				findGeneratedSummary: summary.findGeneratedSummary,
				markSummaryPending: summary.markSummaryPending,
				findArticleCrawlStatus: articleCrawl.findArticleCrawlStatus,
				markCrawlPending: articleCrawl.markCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				appOrigin: TEST_APP_ORIGIN,
			});
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/1" });
			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/2" });
			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/3" });

			const queueResponse = await agent.get("/queue");
			const doc = new JSDOM(queueResponse.text).window.document;
			const articles = doc.querySelectorAll("[data-test-article]");
			const id1 = articles[0]?.getAttribute("data-test-article");

			await agent
				.post(`/queue/${id1}/status`)
				.type("form")
				.send({ status: "read" });

			const response = await agent.get("/export/download");
			const data = JSON.parse(response.text);

			expect(data.articleCount).toBe(3);
			const statuses = data.articles.map(
				(a: { status: string }) => a.status,
			);
			expect(statuses).toContain("unread");
			expect(statuses).toContain("read");
		});
	});
});

describe("fetchAllArticles", () => {
	it("should paginate through all articles when total exceeds page size", async () => {
		const store = initInMemoryArticleStore();
		const userId = "test-user" as UserId;

		for (let i = 0; i < 3; i++) {
			await store.saveArticle({
				userId,
				url: `https://example.com/article-${i}`,
				metadata: {
					title: `Article ${i}`,
					siteName: "example.com",
					excerpt: "An excerpt",
					wordCount: 100,
				},
				estimatedReadTime: 1 as Minutes,
			});
		}

		const articles = await fetchAllArticles(store.findArticlesByUser, userId, 1);

		expect(articles).toHaveLength(3);
	});
});
