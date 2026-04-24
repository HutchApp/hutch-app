import request from "supertest";
import { initInMemoryArticleCrawl } from "../../../providers/article-crawl/in-memory-article-crawl";
import { initInMemoryArticleStore } from "../../../providers/article-store/in-memory-article-store";
import { initRefreshArticleIfStale } from "../../../providers/article-freshness/check-content-freshness";
import type { PublishRefreshArticleContent } from "../../../providers/events/publish-refresh-article-content.types";
import type { PublishUpdateFetchTimestamp } from "../../../providers/events/publish-update-fetch-timestamp.types";
import { createTestApp } from "../../../test-app";
import {
	TEST_APP_ORIGIN,
	createFakeApplyParseResult,
	createFakePublishLinkSaved,
	createFakePublishSaveAnonymousLink,
	createFakeSummaryProvider,
	createNoopLogError,
	defaultHttpErrorMessageMapping,
	initReadabilityParser,
	stubCrawlArticle,
} from "../../../test-app-fakes";

async function loginAgent(app: ReturnType<typeof createTestApp>["app"], auth: ReturnType<typeof createTestApp>["auth"]) {
	await auth.createUser({ email: "test@example.com", password: "password123" });
	const agent = request.agent(app);
	await agent
		.post("/login")
		.type("form")
		.send({ email: "test@example.com", password: "password123" });
	return agent;
}

describe("Queue freshness integration", () => {
	it("publishes UpdateFetchTimestampCommand on first save, then RefreshArticleContentCommand on re-save", async () => {
		const articleStore = initInMemoryArticleStore();
		const refreshPublished: Parameters<PublishRefreshArticleContent>[0][] = [];
		const timestampPublished: Parameters<PublishUpdateFetchTimestamp>[0][] = [];

		const { refreshArticleIfStale } = initRefreshArticleIfStale({
			findArticleFreshness: articleStore.findArticleFreshness,
			crawlArticle: async (params) => {
				if (!params.etag && !params.lastModified) {
					return {
						status: "fetched",
						html: "<html><head><title>Updated</title></head><body><article><p>New content</p></article></body></html>",
						etag: '"fresh-etag"',
					};
				}
				return { status: "not-modified" };
			},
			parseHtml: () => ({
				ok: true as const,
				article: {
					title: "Updated Article",
					siteName: "example.com",
					excerpt: "New content",
					wordCount: 100,
					content: "<p>New content</p>",
				},
			}),
			publishRefreshArticleContent: async (p) => { refreshPublished.push(p); },
			publishUpdateFetchTimestamp: async (p) => { timestampPublished.push(p); },
			now: () => new Date(),
			staleTtlMs: 0,
		});

		const articleCrawl = initInMemoryArticleCrawl();
		const { parseArticle } = initReadabilityParser({ crawlArticle: stubCrawlArticle, sitePreParsers: [], logError: createNoopLogError() });
		const applyParseResult = createFakeApplyParseResult({ articleStore, articleCrawl, parseArticle });
		const summary = createFakeSummaryProvider();
		const { app, auth } = createTestApp({
			articleStore,
			articleCrawl,
			parseArticle,
			crawlArticle: stubCrawlArticle,
			publishLinkSaved: createFakePublishLinkSaved(applyParseResult),
			publishSaveAnonymousLink: createFakePublishSaveAnonymousLink(applyParseResult),
			publishUpdateFetchTimestamp: async (p) => { timestampPublished.push(p); },
			findGeneratedSummary: summary.findGeneratedSummary,
			markSummaryPending: summary.markSummaryPending,
			findArticleCrawlStatus: articleCrawl.findArticleCrawlStatus,
			markCrawlPending: articleCrawl.markCrawlPending,
			forceMarkCrawlPending: articleCrawl.forceMarkCrawlPending,
			refreshArticleIfStale,
			httpErrorMessageMapping: defaultHttpErrorMessageMapping,
			exchangeGoogleCode: undefined,
			logError: createNoopLogError(),
			adminEmails: [],
			appOrigin: TEST_APP_ORIGIN,
		});
		const agent = await loginAgent(app, auth);

		await agent
			.post("/queue/save")
			.type("form")
			.send({ url: "https://example.com/article" });

		expect(timestampPublished).toHaveLength(1);
		expect(timestampPublished[0]).toEqual({
			url: "https://example.com/article",
			contentFetchedAt: expect.any(String),
		});
		expect(refreshPublished).toHaveLength(0);

		await agent
			.post("/queue/save")
			.type("form")
			.send({ url: "https://example.com/article" });

		expect(refreshPublished).toHaveLength(1);
		expect(refreshPublished[0]).toEqual({
			url: "https://example.com/article",
			metadata: expect.objectContaining({
				title: "Updated Article",
				siteName: "example.com",
				wordCount: 100,
			}),
			estimatedReadTime: expect.any(Number),
			etag: '"fresh-etag"',
			lastModified: undefined,
			contentFetchedAt: expect.any(String),
		});
	});
});
