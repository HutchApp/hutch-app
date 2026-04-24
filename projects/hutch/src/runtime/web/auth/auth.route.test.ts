import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import request from "supertest";
import { createTestApp } from "../../test-app";

import { initInMemoryArticleCrawl } from "../../providers/article-crawl/in-memory-article-crawl";
import { initInMemoryArticleStore } from "../../providers/article-store/in-memory-article-store";
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
} from "../../test-app-fakes";

describe("Auth routes", () => {
	describe("GET /login", () => {
		it("should render the login form", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			const response = await request(app).get("/login");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector('[data-test-form="login"]')?.getAttribute("action")).toBe("/login");
			expect(doc.querySelector('input[name="email"]')?.getAttribute("type")).toBe("email");
			expect(doc.querySelector('input[name="password"]')?.getAttribute("type")).toBe("password");
		});

		it("should redirect authenticated user to /queue", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			await auth.createUser({ email: "test@example.com", password: "password123" });

			const agent = request.agent(app);
			await agent.post("/login").type("form").send({ email: "test@example.com", password: "password123" });

			const response = await agent.get("/login");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});

		it("should include return URL in form action when provided", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			const response = await request(app).get("/login?return=%2Foauth%2Fauthorize%3Fclient_id%3Dtest");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			const action = doc.querySelector('[data-test-form="login"]')?.getAttribute("action");
			expect(action).toContain("/login?return=");
		});

		it("should pass return URL to signup link", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			const response = await request(app).get("/login?return=%2Foauth%2Fauthorize%3Fclient_id%3Dtest");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			const signupLink = doc.querySelector(".auth-card__footer:not(.auth-card__footer--forgot) a")?.getAttribute("href");
			expect(signupLink).toContain("/signup?return=");
		});
	});

	describe("POST /login", () => {
		it("should redirect to /queue on valid credentials", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			await auth.createUser({ email: "test@example.com", password: "password123" });

			const agent = request.agent(app);
			const response = await agent
				.post("/login")
				.type("form")
				.send({ email: "test@example.com", password: "password123" });

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
			expect(response.headers["set-cookie"].length).toBeGreaterThan(0);
		});

		it("should show error on invalid credentials", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});

			const response = await request(app)
				.post("/login")
				.type("form")
				.send({ email: "test@example.com", password: "wrongpassword" });

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-global-error]")?.textContent).toContain(
				"Invalid email or password",
			);
		});

		it("should redirect to return URL after successful login", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			await auth.createUser({ email: "test@example.com", password: "password123" });

			const response = await request(app)
				.post("/login?return=%2Foauth%2Fauthorize%3Fclient_id%3Dtest")
				.type("form")
				.send({ email: "test@example.com", password: "password123" });

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/oauth/authorize?client_id=test");
		});

		it("should ignore protocol-relative return URLs", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			await auth.createUser({ email: "test@example.com", password: "password123" });

			const response = await request(app)
				.post("/login?return=%2F%2Fevil.com")
				.type("form")
				.send({ email: "test@example.com", password: "password123" });

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});

		it("should ignore non-relative return URLs", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			await auth.createUser({ email: "test@example.com", password: "password123" });

			const response = await request(app)
				.post("/login?return=https%3A%2F%2Fevil.com")
				.type("form")
				.send({ email: "test@example.com", password: "password123" });

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});

		it("should show validation error for empty email", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});

			const response = await request(app)
				.post("/login")
				.type("form")
				.send({ email: "", password: "password123" });

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector('[data-test-error="email"]')?.textContent).toBe("Please enter a valid email address");
		});

		it("should preserve return URL in form action after invalid credentials", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});

			const response = await request(app)
				.post("/login?return=%2Foauth%2Fauthorize%3Fclient_id%3Dtest")
				.type("form")
				.send({ email: "test@example.com", password: "wrongpassword" });

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			const action = doc.querySelector('[data-test-form="login"]')?.getAttribute("action");
			expect(action).toContain("/login?return=");
		});

		it("should preserve return URL in form action after validation error", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});

			const response = await request(app)
				.post("/login?return=%2Foauth%2Fauthorize%3Fclient_id%3Dtest")
				.type("form")
				.send({ email: "", password: "password123" });

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			const action = doc.querySelector('[data-test-form="login"]')?.getAttribute("action");
			expect(action).toContain("/login?return=");
		});
	});

	describe("GET /signup", () => {
		it("should render the signup form", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			const response = await request(app).get("/signup");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector('[data-test-form="signup"]')?.getAttribute("action")).toBe("/signup");
			expect(doc.querySelector('input[name="confirmPassword"]')?.getAttribute("type")).toBe("password");
		});

		it("should redirect authenticated user to /queue", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			await auth.createUser({ email: "test@example.com", password: "password123" });

			const agent = request.agent(app);
			await agent.post("/login").type("form").send({ email: "test@example.com", password: "password123" });

			const response = await agent.get("/signup");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});

		it("should include return URL in form action when provided", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			const response = await request(app).get("/signup?return=%2Foauth%2Fauthorize%3Fclient_id%3Dtest");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			const action = doc.querySelector('[data-test-form="signup"]')?.getAttribute("action");
			expect(action).toContain("/signup?return=");
		});

		it("should pass return URL to login link", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			const response = await request(app).get("/signup?return=%2Foauth%2Fauthorize%3Fclient_id%3Dtest");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			const loginLink = doc.querySelector(".auth-card__footer a")?.getAttribute("href");
			expect(loginLink).toContain("/login?return=");
		});
	});

	describe("POST /signup", () => {
		it("should create user and redirect to /queue", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});

			const response = await request(app).post("/signup").type("form").send({
				email: "new@example.com",
				password: "password123",
				confirmPassword: "password123",
			});

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
			expect(response.headers["set-cookie"].length).toBeGreaterThan(0);
		});

		it("should redirect to return URL after successful signup", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});

			const response = await request(app)
				.post("/signup?return=%2Foauth%2Fauthorize%3Fclient_id%3Dtest")
				.type("form")
				.send({
					email: "new@example.com",
					password: "password123",
					confirmPassword: "password123",
				});

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/oauth/authorize?client_id=test");
		});

		it("should ignore protocol-relative return URLs on signup", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});

			const response = await request(app)
				.post("/signup?return=%2F%2Fevil.com")
				.type("form")
				.send({
					email: "new@example.com",
					password: "password123",
					confirmPassword: "password123",
				});

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});

		it("should ignore non-relative return URLs on signup", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});

			const response = await request(app)
				.post("/signup?return=https%3A%2F%2Fevil.com")
				.type("form")
				.send({
					email: "new@example.com",
					password: "password123",
					confirmPassword: "password123",
				});

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});

		it("should show error for duplicate email", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			await auth.createUser({ email: "existing@example.com", password: "password123" });

			const response = await request(app).post("/signup").type("form").send({
				email: "existing@example.com",
				password: "password123",
				confirmPassword: "password123",
			});

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-global-error]")?.textContent).toContain(
				"already exists",
			);
		});

		it("should show error for mismatched passwords", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});

			const response = await request(app).post("/signup").type("form").send({
				email: "new@example.com",
				password: "password123",
				confirmPassword: "differentpassword",
			});

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(
				doc.querySelector('[data-test-error="confirmPassword"]')?.textContent,
			).toBe("Passwords do not match");
		});

		it("should preserve return URL in form action after mismatched passwords", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});

			const response = await request(app)
				.post("/signup?return=%2Foauth%2Fauthorize%3Fclient_id%3Dtest")
				.type("form")
				.send({
					email: "new@example.com",
					password: "password123",
					confirmPassword: "differentpassword",
				});

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			const action = doc.querySelector('[data-test-form="signup"]')?.getAttribute("action");
			expect(action).toContain("/signup?return=");
		});

		it("should preserve return URL in form action after duplicate email", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			await auth.createUser({ email: "existing@example.com", password: "password123" });

			const response = await request(app)
				.post("/signup?return=%2Foauth%2Fauthorize%3Fclient_id%3Dtest")
				.type("form")
				.send({
					email: "existing@example.com",
					password: "password123",
					confirmPassword: "password123",
				});

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			const action = doc.querySelector('[data-test-form="signup"]')?.getAttribute("action");
			expect(action).toContain("/signup?return=");
		});

		it("should show error for short password", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});

			const response = await request(app).post("/signup").type("form").send({
				email: "new@example.com",
				password: "short",
				confirmPassword: "short",
			});

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector('[data-test-error="password"]')?.textContent).toBe("Password must be at least 8 characters");
		});
	});

	describe("GET /verify-email", () => {
		it("should show error when no token is provided", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			const response = await request(app).get("/verify-email");

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector(".auth-card__subtitle")?.textContent).toContain(
				"No verification token provided",
			);
		});

		it("should show error for invalid token", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			const response = await request(app).get("/verify-email?token=invalid-token");

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector(".auth-card__subtitle")?.textContent).toContain(
				"invalid or has already been used",
			);
		});

		it("should verify email with valid token", async () => {
			const articleStore = initInMemoryArticleStore();
			const articleCrawl = initInMemoryArticleCrawl();
			const crawlArticle = stubCrawlArticle;
			const { parseArticle } = initReadabilityParser({ crawlArticle, sitePreParsers: [], logError: createNoopLogError() });
			const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle });
			const summary = createFakeSummaryProvider();
			const { app, auth, emailVerification } = createTestApp({
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			const createResult = await auth.createUser({ email: "verify@example.com", password: "password123" });
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) return;

			const token = await emailVerification.createVerificationToken({
				userId: createResult.userId,
				email: "verify@example.com",
			});

			const response = await request(app).get(`/verify-email?token=${token}`);

			expect(response.status).toBe(200);
		});

		it("should mark session email verified when user is logged in during verification", async () => {
			const articleStore = initInMemoryArticleStore();
			const articleCrawl = initInMemoryArticleCrawl();
			const crawlArticle = stubCrawlArticle;
			const { parseArticle } = initReadabilityParser({ crawlArticle, sitePreParsers: [], logError: createNoopLogError() });
			const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle });
			const summary = createFakeSummaryProvider();
			const { app, auth, emailVerification } = createTestApp({
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			const createResult = await auth.createUser({ email: "session@example.com", password: "password123" });
			expect(createResult.ok).toBe(true);
			if (!createResult.ok) return;

			const token = await emailVerification.createVerificationToken({
				userId: createResult.userId,
				email: "session@example.com",
			});

			const agent = request.agent(app);
			await agent.post("/login").type("form").send({ email: "session@example.com", password: "password123" });

			const response = await agent.get(`/verify-email?token=${token}`);

			expect(response.status).toBe(200);
		});
	});

	describe("POST /logout", () => {
		it("should clear session and redirect to /", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			await auth.createUser({ email: "test@example.com", password: "password123" });

			const agent = request.agent(app);
			await agent
				.post("/login")
				.type("form")
				.send({ email: "test@example.com", password: "password123" });

			const response = await agent.post("/logout");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/");
		});

		it("should handle logout when no session cookie exists", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});

			const response = await request(app).post("/logout");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/");
		});
	});

	describe("Google sign-in button", () => {
		function getGoogleButton(html: string) {
			const doc = new JSDOM(html).window.document;
			const section = doc.querySelector("[data-test-google-section]");
			assert(section, "google section must be rendered");
			const link = section.querySelector(".auth-google-button");
			assert(link, "google button must be rendered");
			return link;
		}

		it("should render Sign in with Google on /login with the Google logo", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			const response = await request(app).get("/login");

			const link = getGoogleButton(response.text);
			expect(link.getAttribute("href")).toBe("/auth/google");
			expect(link.querySelector(".auth-google-button__label")?.textContent).toBe("Sign in with Google");
			const logo = link.querySelector("svg.auth-google-button__logo");
			assert(logo, "google logo must be rendered");
			expect(logo.getAttribute("viewBox")).toBe("0 0 18 18");
			expect(logo.getAttribute("aria-hidden")).toBe("true");
			expect(logo.querySelectorAll('path[fill="#4285F4"]').length).toBe(1);
			expect(logo.querySelectorAll('path[fill="#34A853"]').length).toBe(1);
			expect(logo.querySelectorAll('path[fill="#FBBC05"]').length).toBe(1);
			expect(logo.querySelectorAll('path[fill="#EA4335"]').length).toBe(1);
		});

		it("should pass return URL through to the Google sign-in link on /login", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			const response = await request(app).get("/login?return=%2Fsave%3Furl%3Dhttps%253A%252F%252Fexample.com");

			const link = getGoogleButton(response.text);
			expect(link.getAttribute("href")).toContain("/auth/google?return=");
		});

		it("should render Sign up with Google on /signup with the Google logo", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			const response = await request(app).get("/signup");

			const link = getGoogleButton(response.text);
			expect(link.getAttribute("href")).toBe("/auth/google");
			expect(link.querySelector(".auth-google-button__label")?.textContent).toBe("Sign up with Google");
			assert(link.querySelector("svg.auth-google-button__logo"), "google logo must be rendered");
		});
	});

	describe("Founding members progress", () => {
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
			forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
			refreshArticleIfStale: createNoopRefreshArticleIfStale(),
			httpErrorMessageMapping: defaultHttpErrorMessageMapping,
			exchangeGoogleCode: undefined,
			logError: createNoopLogError(),
			adminEmails: [],
			appOrigin: TEST_APP_ORIGIN,
		});

		it("should render the progress bar on GET /login with zero users", async () => {
			const response = await request(app).get("/login");
			const doc = new JSDOM(response.text).window.document;

			const label = doc.querySelector("[data-test-founding-progress] .founding-progress__label");
			expect(label?.textContent).toBe("0 / 100 founding members");

			const fill = doc.querySelector("[data-test-founding-progress] .founding-progress__fill");
			expect(fill?.getAttribute("style")).toBe("width: 0%");

			const exhausted = doc.querySelector("[data-test-founding-exhausted]");
			assert(exhausted, "exhausted message must be rendered");
			expect(exhausted.classList.contains("founding-progress__exhausted--hidden")).toBe(true);
		});

		it("should render the progress bar on GET /signup with zero users", async () => {
			const response = await request(app).get("/signup");
			const doc = new JSDOM(response.text).window.document;

			const label = doc.querySelector("[data-test-founding-progress] .founding-progress__label");
			expect(label?.textContent).toBe("0 / 100 founding members");
		});

		it("should render an explanatory caption on /login for visitors who skipped the homepage", async () => {
			const response = await request(app).get("/login");
			const doc = new JSDOM(response.text).window.document;

			const caption = doc.querySelector("[data-test-founding-caption]");
			assert(caption, "founding caption must be rendered");
			expect(caption.textContent).toBe("First 100 accounts are free, forever.");
		});

		it("should render an explanatory caption on /signup for visitors who skipped the homepage", async () => {
			const response = await request(app).get("/signup");
			const doc = new JSDOM(response.text).window.document;

			const caption = doc.querySelector("[data-test-founding-caption]");
			assert(caption, "founding caption must be rendered");
			expect(caption.textContent).toBe("First 100 accounts are free, forever.");
		});

		it("should keep the progress bar on POST /login 422 responses", async () => {
			const response = await request(app)
				.post("/login")
				.type("form")
				.send({ email: "test@example.com", password: "wrongpassword" });

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			const label = doc.querySelector("[data-test-founding-progress] .founding-progress__label");
			expect(label?.textContent).toBe("0 / 100 founding members");
		});

		it("should keep the progress bar on POST /signup 422 responses", async () => {
			const response = await request(app)
				.post("/signup")
				.type("form")
				.send({ email: "", password: "short", confirmPassword: "short" });

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			const label = doc.querySelector("[data-test-founding-progress] .founding-progress__label");
			expect(label?.textContent).toBe("0 / 100 founding members");
		});
	});

	describe("Founding members progress — exhausted allocation", () => {
		it("should render the exhausted message on both /login and /signup when over the limit", async () => {
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
				forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
				refreshArticleIfStale: createNoopRefreshArticleIfStale(),
				httpErrorMessageMapping: defaultHttpErrorMessageMapping,
				exchangeGoogleCode: undefined,
				logError: createNoopLogError(),
				adminEmails: [],
				appOrigin: TEST_APP_ORIGIN,
			});
			for (let i = 0; i < 101; i++) {
				await auth.createUser({ email: `user${i}@test.com`, password: "password123" });
			}

			const loginDoc = new JSDOM((await request(app).get("/login")).text).window.document;
			const loginExhausted = loginDoc.querySelector("[data-test-founding-exhausted]");
			assert(loginExhausted, "exhausted message must be rendered on /login");
			expect(loginExhausted.textContent).toContain("The free allocation has been exhausted");
			expect(loginExhausted.classList.contains("founding-progress__exhausted--visible")).toBe(true);
			expect(
				loginDoc.querySelector("[data-test-founding-progress] .founding-progress__fill")?.getAttribute("style"),
			).toBe("width: 100%");
			expect(
				loginDoc.querySelector("[data-test-founding-progress] .founding-progress__label")?.textContent,
			).toBe("101 / 100 founding members");

			const signupDoc = new JSDOM((await request(app).get("/signup")).text).window.document;
			const signupExhausted = signupDoc.querySelector("[data-test-founding-exhausted]");
			assert(signupExhausted, "exhausted message must be rendered on /signup");
			expect(signupExhausted.textContent).toContain("The free allocation has been exhausted");
			expect(signupExhausted.classList.contains("founding-progress__exhausted--visible")).toBe(true);
		}, 30000);
	});
});
