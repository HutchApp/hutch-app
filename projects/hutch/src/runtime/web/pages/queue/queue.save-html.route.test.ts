import assert from "node:assert";
import request from "supertest";
import type { Token, Client } from "@node-oauth/oauth2-server";
import { initInMemoryArticleCrawl } from "../../../providers/article-crawl/in-memory-article-crawl";
import { initInMemoryArticleStore } from "../../../providers/article-store/in-memory-article-store";
import { initInMemoryPendingHtml } from "../../../providers/pending-html/in-memory-pending-html";
import type { PublishSaveLinkRawHtmlCommand } from "../../../providers/events/publish-save-link-raw-html-command.types";
import type { UserId } from "../../../domain/user/user.types";
import { createTestApp } from "../../../test-app";
import { SIREN_MEDIA_TYPE } from "../../api/siren";
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

const TEST_USER_ID = "test-user-123" as UserId;

function createTestToken(): Token {
	return {
		accessToken: "test-access-token",
		accessTokenExpiresAt: new Date(Date.now() + 3600000),
		refreshToken: "test-refresh-token",
		refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600000),
		client: {
			id: "hutch-firefox-extension",
			grants: ["authorization_code", "refresh_token"],
			redirectUris: ["http://127.0.0.1:3000/oauth/callback"],
		} as Client,
		user: { id: TEST_USER_ID },
	};
}

async function createAccessToken(testApp: ReturnType<typeof createTestApp>): Promise<string> {
	const client = await testApp.oauthModel.getClient("hutch-firefox-extension", "");
	assert(client, "Test client must exist");
	const testToken = createTestToken();
	const token = await testApp.oauthModel.saveToken(testToken, client, { id: TEST_USER_ID });
	assert(token, "Token should be saved");
	return token.accessToken;
}

describe("POST /queue/save-html", () => {
	function setup() {
		const articleStore = initInMemoryArticleStore();
		const articleCrawl = initInMemoryArticleCrawl();
		const pendingHtml = initInMemoryPendingHtml();
		const summary = createFakeSummaryProvider();
		const { parseArticle } = initReadabilityParser({ crawlArticle: stubCrawlArticle, sitePreParsers: [], logError: createNoopLogError() });
		const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle });
		const publishedSaveHtml: Parameters<PublishSaveLinkRawHtmlCommand>[0][] = [];
		const publishedLinkSaved: { url: string; userId: string }[] = [];
		const fakePublishLinkSaved = createFakePublishLinkSaved(applyParseResult);
		const publishSaveLinkRawHtmlCommand: PublishSaveLinkRawHtmlCommand = async (params) => {
			publishedSaveHtml.push(params);
		};

		const testApp = createTestApp({
			articleStore,
			articleCrawl,
			parseArticle,
			crawlArticle: stubCrawlArticle,
			publishLinkSaved: async (params) => {
				publishedLinkSaved.push(params);
				await fakePublishLinkSaved(params);
			},
			publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
			publishSaveLinkRawHtmlCommand,
			publishUpdateFetchTimestamp: createInMemoryPublishUpdateFetchTimestamp(),
			putPendingHtml: pendingHtml.putPendingHtml,
			findGeneratedSummary: summary.findGeneratedSummary,
			markSummaryPending: summary.markSummaryPending,
			findArticleCrawlStatus: articleCrawl.findArticleCrawlStatus,
			markCrawlPending: articleCrawl.markCrawlPending,
			forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
			refreshArticleIfStale: createNoopRefreshArticleIfStale(),
			httpErrorMessageMapping: defaultHttpErrorMessageMapping,
			exchangeGoogleCode: undefined,
			logError: createNoopLogError(),
			appOrigin: TEST_APP_ORIGIN,
			adminEmails: [],
			recrawlServiceToken: "test-service-token-abcdefghij",
		});
		return { testApp, pendingHtml, publishedSaveHtml, publishedLinkSaved };
	}

	it("returns 201 with a Siren article entity", async () => {
		const { testApp } = setup();
		const accessToken = await createAccessToken(testApp);

		const response = await request(testApp.app)
			.post("/queue/save-html")
			.set("Accept", SIREN_MEDIA_TYPE)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				url: "https://example.com/article",
				rawHtml: "<html><body><p>captured</p></body></html>",
				title: "Captured",
			});

		expect(response.status).toBe(201);
		expect(response.headers["content-type"]).toContain(SIREN_MEDIA_TYPE);
		expect(response.body.properties).toEqual(expect.objectContaining({
			url: "https://example.com/article",
		}));
	});

	it("publishes both SaveLinkRawHtmlCommand and LinkSaved (Tier 1 still runs)", async () => {
		const { testApp, publishedSaveHtml, publishedLinkSaved } = setup();
		const accessToken = await createAccessToken(testApp);

		await request(testApp.app)
			.post("/queue/save-html")
			.set("Accept", SIREN_MEDIA_TYPE)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				url: "https://example.com/article",
				rawHtml: "<html>captured</html>",
				title: "Captured",
			});

		expect(publishedLinkSaved).toHaveLength(1);
		expect(publishedLinkSaved[0]).toEqual(expect.objectContaining({
			url: "https://example.com/article",
		}));
		expect(publishedSaveHtml).toHaveLength(1);
		expect(publishedSaveHtml[0]).toEqual(expect.objectContaining({
			url: "https://example.com/article",
			title: "Captured",
		}));
	});

	it("stores the rawHtml under the URL's pending-html key", async () => {
		const { testApp, pendingHtml } = setup();
		const accessToken = await createAccessToken(testApp);

		await request(testApp.app)
			.post("/queue/save-html")
			.set("Accept", SIREN_MEDIA_TYPE)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				url: "https://example.com/article",
				rawHtml: "<html>captured</html>",
			});

		expect(pendingHtml.readPendingHtml("https://example.com/article")).toBe("<html>captured</html>");
	});

	it("returns 500 when the underlying article save throws", async () => {
		const articleStore = initInMemoryArticleStore();
		const articleCrawl = initInMemoryArticleCrawl();
		const pendingHtml = initInMemoryPendingHtml();
		const summary = createFakeSummaryProvider();
		const { parseArticle } = initReadabilityParser({ crawlArticle: stubCrawlArticle, sitePreParsers: [], logError: createNoopLogError() });
		const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle });
		const errors: Error[] = [];

		const testApp = createTestApp({
			articleStore,
			articleCrawl,
			parseArticle,
			crawlArticle: stubCrawlArticle,
			publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
			publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
			publishSaveLinkRawHtmlCommand: async () => {},
			publishUpdateFetchTimestamp: createInMemoryPublishUpdateFetchTimestamp(),
			putPendingHtml: pendingHtml.putPendingHtml,
			findGeneratedSummary: summary.findGeneratedSummary,
			markSummaryPending: summary.markSummaryPending,
			findArticleCrawlStatus: articleCrawl.findArticleCrawlStatus,
			markCrawlPending: articleCrawl.markCrawlPending,
			forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
			refreshArticleIfStale: async () => { throw new Error("boom"); },
			httpErrorMessageMapping: defaultHttpErrorMessageMapping,
			exchangeGoogleCode: undefined,
			logError: (_msg, err) => { if (err) errors.push(err); },
			appOrigin: TEST_APP_ORIGIN,
			adminEmails: [],
			recrawlServiceToken: "test-service-token-abcdefghij",
		});
		const accessToken = await createAccessToken(testApp);

		const response = await request(testApp.app)
			.post("/queue/save-html")
			.set("Accept", SIREN_MEDIA_TYPE)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				url: "https://example.com/article",
				rawHtml: "<html>captured</html>",
			});

		expect(response.status).toBe(500);
		expect(response.body.properties.code).toBe("save-failed");
		expect(errors).toHaveLength(1);
	});

	it("returns 422 when the body fails schema validation", async () => {
		const { testApp } = setup();
		const accessToken = await createAccessToken(testApp);

		const response = await request(testApp.app)
			.post("/queue/save-html")
			.set("Accept", SIREN_MEDIA_TYPE)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ url: "not-a-url", rawHtml: "" });

		expect(response.status).toBe(422);
		expect(response.headers["content-type"]).toContain(SIREN_MEDIA_TYPE);
	});

	it("returns 406 when an authenticated cookie session requests text/html on a Siren-only route", async () => {
		const { testApp } = setup();
		await testApp.auth.createUser({ email: "test@example.com", password: "password123" });
		const agent = request.agent(testApp.app);
		await agent
			.post("/login")
			.type("form")
			.send({ email: "test@example.com", password: "password123" });

		const response = await agent
			.post("/queue/save-html")
			.set("Accept", "text/html")
			.send({
				url: "https://example.com/article",
				rawHtml: "<html>captured</html>",
			});

		expect(response.status).toBe(406);
	});

	it("does not affect the legacy POST /queue (Siren save-article still works)", async () => {
		const { testApp, publishedSaveHtml, publishedLinkSaved } = setup();
		const accessToken = await createAccessToken(testApp);

		const response = await request(testApp.app)
			.post("/queue")
			.set("Accept", SIREN_MEDIA_TYPE)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ url: "https://example.com/article" });

		expect(response.status).toBe(201);
		expect(publishedLinkSaved).toHaveLength(1);
		expect(publishedSaveHtml).toHaveLength(0);
	});
});

describe("Collection-Siren advertises both save actions", () => {
	it("includes both save-article and save-html actions on the queue collection", async () => {
		const articleStore = initInMemoryArticleStore();
		const articleCrawl = initInMemoryArticleCrawl();
		const pendingHtml = initInMemoryPendingHtml();
		const summary = createFakeSummaryProvider();
		const { parseArticle } = initReadabilityParser({ crawlArticle: stubCrawlArticle, sitePreParsers: [], logError: createNoopLogError() });
		const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle });

		const testApp = createTestApp({
			articleStore,
			articleCrawl,
			parseArticle,
			crawlArticle: stubCrawlArticle,
			publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
			publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
			publishSaveLinkRawHtmlCommand: async () => {},
			publishUpdateFetchTimestamp: createInMemoryPublishUpdateFetchTimestamp(),
			putPendingHtml: pendingHtml.putPendingHtml,
			findGeneratedSummary: summary.findGeneratedSummary,
			markSummaryPending: summary.markSummaryPending,
			findArticleCrawlStatus: articleCrawl.findArticleCrawlStatus,
			markCrawlPending: articleCrawl.markCrawlPending,
			forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
			refreshArticleIfStale: createNoopRefreshArticleIfStale(),
			httpErrorMessageMapping: defaultHttpErrorMessageMapping,
			exchangeGoogleCode: undefined,
			logError: createNoopLogError(),
			appOrigin: TEST_APP_ORIGIN,
			adminEmails: [],
			recrawlServiceToken: "test-service-token-abcdefghij",
		});
		const accessToken = await createAccessToken(testApp);

		const response = await request(testApp.app)
			.get("/queue")
			.set("Accept", SIREN_MEDIA_TYPE)
			.set("Authorization", `Bearer ${accessToken}`);

		expect(response.status).toBe(200);
		const actionNames: string[] = response.body.actions.map((a: { name: string }) => a.name);
		expect(actionNames).toContain("save-article");
		expect(actionNames).toContain("save-html");

		const saveHtmlAction = response.body.actions.find((a: { name: string }) => a.name === "save-html");
		expect(saveHtmlAction).toEqual(expect.objectContaining({
			href: "/queue/save-html",
			method: "POST",
			type: "application/json",
		}));
		const fieldNames = saveHtmlAction.fields.map((f: { name: string }) => f.name);
		expect(fieldNames).toEqual(expect.arrayContaining(["url", "rawHtml", "title"]));
	});
});
