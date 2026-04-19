import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import request from "supertest";
import { MinutesSchema } from "../../../domain/article/article.schema";
import { UserIdSchema } from "../../../domain/user/user.schema";
import type {
	ParseArticle,
	ParseArticleResult,
} from "../../../providers/article-parser/article-parser.types";
import type { FindCachedSummary } from "../../../providers/article-summary/article-summary.types";
import { createTestApp } from "../../../test-app";

const ARTICLE_URL = "https://example.com/post";
const ENCODED = encodeURIComponent(ARTICLE_URL);

type OkParseResult = Extract<ParseArticleResult, { ok: true }>;
type ParsedArticle = OkParseResult["article"];

function buildParseResult(
	overrides: Partial<ParsedArticle> = {},
): ParseArticleResult {
	return {
		ok: true,
		article: {
			title: "Hello World",
			siteName: "example.com",
			excerpt: "A lovely article.",
			wordCount: 500,
			content: "<p>Body copy.</p>",
			imageUrl: "https://cdn.example.com/hero.jpg",
			...overrides,
		},
	};
}

function ctaAction(doc: Document): Element {
	const link = doc.querySelector("[data-test-view-cta-action]");
	assert(link, "cta action must be rendered");
	return link;
}

describe("View routes", () => {
	describe("GET /view/<encoded-url>", () => {
		it("renders the article body for an anonymous visitor (200)", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-reader-title]")?.textContent).toBe(
				"Hello World",
			);
			expect(
				doc.querySelector("[data-test-reader-content]")?.innerHTML.trim(),
			).toBe("<p>Body copy.</p>");
		});

		it("renders the article when the path arrives with decoded slashes (API Gateway shape)", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ARTICLE_URL}`);

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-reader-title]")?.textContent).toBe(
				"Hello World",
			);
		});

		it("renders the article when the scheme's second slash has been collapsed", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(
				`/view/${ARTICLE_URL.replace("://", ":/")}`,
			);

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-reader-title]")?.textContent).toBe(
				"Hello World",
			);
		});

		it("renders a Save action pointing to /save with the article URL in the href", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			const action = ctaAction(doc);
			expect(action.textContent).toBe("Save to My Queue");
			const href = action.getAttribute("href");
			assert(href, "action must have an href");
			const parsed = new URL(href, "http://localhost");
			expect(parsed.pathname).toBe("/save");
			expect(parsed.searchParams.get("url")).toBe(ARTICLE_URL);
		});

		it("includes utm_* query params in the Save action href", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(
				`/view/${ENCODED}?utm_source=medium&utm_campaign=x&foo=bar`,
			);

			const doc = new JSDOM(response.text).window.document;
			const href = ctaAction(doc).getAttribute("href");
			assert(href, "action must have an href");
			const parsed = new URL(href, "http://localhost");
			expect(parsed.searchParams.get("url")).toBe(ARTICLE_URL);
			expect(parsed.searchParams.get("utm_source")).toBe("medium");
			expect(parsed.searchParams.get("utm_campaign")).toBe("x");
			expect(parsed.searchParams.get("foo")).toBeNull();
		});

		it("renders the Save action for an authenticated viewer when the URL is not in the store", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app, auth } = createTestApp({ parseArticle });
			await auth.createUser({
				email: "reader@example.com",
				password: "password123",
			});
			const agent = request.agent(app);
			await agent
				.post("/login")
				.type("form")
				.send({ email: "reader@example.com", password: "password123" });

			const response = await agent.get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			const action = ctaAction(doc);
			expect(action.textContent).toBe("Save to My Queue");
			expect(action.getAttribute("href")?.startsWith("/save?")).toBe(true);
		});

		it("renders the Save action for an authenticated viewer even when the URL is already in their queue", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app, auth } = createTestApp({ parseArticle });
			await auth.createUser({
				email: "reader@example.com",
				password: "password123",
			});
			const agent = request.agent(app);
			await agent
				.post("/login")
				.type("form")
				.send({ email: "reader@example.com", password: "password123" });
			await agent.post("/queue/save").type("form").send({ url: ARTICLE_URL });

			const response = await agent.get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			const action = ctaAction(doc);
			expect(action.textContent).toBe("Save to My Queue");
			expect(action.getAttribute("href")?.startsWith("/save?")).toBe(true);
		});

		it("renders the Save action for an anonymous viewer even when another user has saved the URL", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app, auth } = createTestApp({ parseArticle });
			await auth.createUser({
				email: "owner@example.com",
				password: "password123",
			});
			const ownerAgent = request.agent(app);
			await ownerAgent
				.post("/login")
				.type("form")
				.send({ email: "owner@example.com", password: "password123" });
			await ownerAgent
				.post("/queue/save")
				.type("form")
				.send({ url: ARTICLE_URL });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			const action = ctaAction(doc);
			expect(action.textContent).toBe("Save to My Queue");
			expect(action.getAttribute("href")?.startsWith("/save?")).toBe(true);
		});

		it("renders a 'View another article' action pointing to /view", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			const actions = doc.querySelectorAll("[data-test-view-cta-action]");
			expect(actions.length).toBe(2);
			const second = actions[1];
			assert(second, "second cta action must be rendered");
			expect(second.textContent).toBe("View another article");
			expect(second.getAttribute("href")).toBe("/view");
		});
	});

	describe("Share balloon", () => {
		it("renders a share button with the canonical view URL and article title", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			const wrap = doc.querySelector("[data-test-view-share-wrap]");
			assert(wrap, "share balloon wrapper must be rendered");
			expect(wrap.hasAttribute("hidden")).toBe(true);
			const btn = doc.querySelector("[data-test-view-share]");
			assert(btn, "share button must be rendered");
			expect(btn.getAttribute("aria-label")).toBe("Share this article");
			expect(btn.getAttribute("data-share-url")).toBe(
				`https://readplace.com/view/${ENCODED}`,
			);
			expect(btn.getAttribute("data-share-title")).toBe("Hello World");
		});

		it("renders a dismiss button that the inline script persists via localStorage", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			const closeBtn = doc.querySelector("[data-test-view-share-close]");
			assert(closeBtn, "share balloon close button must be rendered");
			expect(closeBtn.getAttribute("aria-label")).toBe("Dismiss message");
			expect(response.text).toContain("readplace.share-dismissed");
			expect(response.text).toContain("view__share-balloon-wrap--open");
		});

		it("schedules the balloon open behind a scroll threshold and timeout", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			expect(response.text).toContain("SCROLL_THRESHOLD_PX");
			expect(response.text).toContain("OPEN_DELAY_MS");
			expect(response.text).toContain("addEventListener('scroll'");
			expect(response.text).toContain("setTimeout(openBalloon");
		});

		it("renders an aria-live status region for share feedback", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			const status = doc.querySelector("[data-view-share-status]");
			assert(status, "share status region must be rendered");
			expect(status.getAttribute("role")).toBe("status");
			expect(status.getAttribute("aria-live")).toBe("polite");
		});

		it("inlines the share script that invokes navigator.share", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			expect(response.text).toContain("navigator.share");
			expect(response.text).toContain("navigator.clipboard");
		});

		it("escapes special characters in the share title attribute", async () => {
			const parseArticle: ParseArticle = async () =>
				buildParseResult({ title: `Ampersand & "Quotes"` });
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			const btn = doc.querySelector("[data-test-view-share]");
			assert(btn, "share button must be rendered");
			expect(btn.getAttribute("data-share-title")).toBe(`Ampersand & "Quotes"`);
		});

		it("is not rendered on the /view landing page", async () => {
			const { app } = createTestApp();

			const response = await request(app).get("/view");

			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-view-share]")).toBeNull();
		});

		it("includes the founder avatar inside the balloon", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			const avatar = doc.querySelector("[data-test-view-share-avatar]");
			assert(avatar, "share balloon avatar must be rendered");
			assert.match(avatar.getAttribute("src") ?? "", /\/fayner-brack\.jpg$/);
		});

		it("renders the founder greeting and share hint inside the balloon", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			expect(
				doc
					.querySelector("[data-test-view-share-greeting]")
					?.textContent?.trim(),
			).toBe("Hi, I'm Fayner.");
		});
	});

	describe("TL;DR rendering", () => {
		it("marks the summary slot visible when a cached summary exists", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const findCachedSummary: FindCachedSummary = async () =>
				"Key points from the article.";
			const { app } = createTestApp({ parseArticle, findCachedSummary });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			const slot = doc.querySelector("[data-test-reader-summary]");
			assert(slot, "summary slot must be rendered");
			expect(
				slot.classList.contains("article-body__summary-slot--visible"),
			).toBe(true);
			expect(
				doc.querySelector(".article-body__summary-text")?.textContent,
			).toBe("Key points from the article.");
		});

		it("marks the summary slot hidden when the cached summary is empty", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const findCachedSummary: FindCachedSummary = async () => "";
			const { app } = createTestApp({ parseArticle, findCachedSummary });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			const slot = doc.querySelector("[data-test-reader-summary]");
			assert(slot, "summary slot must be rendered");
			expect(
				slot.classList.contains("article-body__summary-slot--hidden"),
			).toBe(true);
		});
	});

	describe("OG metadata", () => {
		it("emits article title, excerpt, image, type and canonical as the publisher URL", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			expect(
				doc.querySelector('meta[property="og:title"]')?.getAttribute("content"),
			).toBe("Hello World Summary | Readplace");
			expect(
				doc
					.querySelector('meta[property="og:description"]')
					?.getAttribute("content"),
			).toBe("A lovely article.");
			expect(
				doc.querySelector('meta[property="og:image"]')?.getAttribute("content"),
			).toBe("https://cdn.example.com/hero.jpg");
			expect(
				doc.querySelector('meta[property="og:type"]')?.getAttribute("content"),
			).toBe("article");
			expect(
				doc.querySelector('link[rel="canonical"]')?.getAttribute("href"),
			).toBe(`https://readplace.com/view/${ENCODED}`);
		});

		it("falls back to the Readplace default images when article has no imageUrl", async () => {
			const parseArticle: ParseArticle = async () => ({
				ok: true,
				article: {
					title: "Hello",
					siteName: "example.com",
					excerpt: "An article.",
					wordCount: 100,
					content: "<p>Body</p>",
				},
			});
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			expect(
				doc.querySelector('meta[property="og:image"]')?.getAttribute("content"),
			).toMatch(/og-image-1200x630\.png$/);
			expect(
				doc
					.querySelector('meta[name="twitter:image"]')
					?.getAttribute("content"),
			).toMatch(/twitter-card-1200x600\.png$/);
		});

		it("emits JSON-LD Article with isBasedOn attributed to the source URL", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			const script = doc.querySelector('script[type="application/ld+json"]');
			assert(script, "JSON-LD script must be rendered");
			const data = JSON.parse(script.textContent ?? "{}");
			expect(data["@type"]).toBe("Article");
			expect(data.isBasedOn).toEqual({ "@type": "Article", url: ARTICLE_URL });
		});

		it("emits robots: index, follow", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			expect(
				doc.querySelector('meta[name="robots"]')?.getAttribute("content"),
			).toBe("index, follow");
		});
	});

	describe("Error paths", () => {
		it("renders the error page for an invalid URL path param (unauthenticated)", async () => {
			const { app } = createTestApp();

			const response = await request(app).get(
				`/view/${encodeURIComponent("not-a-url")}`,
			);

			expect(response.status).toBe(200);
			expect(response.headers["content-type"]).toMatch(/text\/html/);
			const doc = new JSDOM(response.text).window.document;
			const meta = doc.querySelector('meta[http-equiv="refresh"]');
			expect(meta?.getAttribute("content")).toBe("5;url=/");
		});

		it("renders the error page redirecting to /queue when authenticated", async () => {
			const { app, auth } = createTestApp();
			await auth.createUser({
				email: "test@example.com",
				password: "password123",
			});
			const agent = request.agent(app);
			await agent
				.post("/login")
				.type("form")
				.send({ email: "test@example.com", password: "password123" });

			const response = await agent.get(
				`/view/${encodeURIComponent("not-a-url")}`,
			);

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			const meta = doc.querySelector('meta[http-equiv="refresh"]');
			expect(meta?.getAttribute("content")).toBe("5;url=/queue");
			const link = doc.querySelector(".save-error__link");
			expect(link?.getAttribute("href")).toBe("/queue");
			expect(link?.textContent).toContain("Go to your queue");
		});

		it("renders the landing form for GET /view without a path param", async () => {
			const { app } = createTestApp();

			const response = await request(app).get("/view");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			const form = doc.querySelector("[data-test-view-landing-form]");
			assert(form, "landing form must be rendered");
			expect(form.getAttribute("method")?.toLowerCase()).toBe("get");
			expect(form.getAttribute("action")).toBe("/view");
			const input = form.querySelector(
				'input[name="url"][data-test-view-landing-input]',
			);
			assert(input, "url input must be rendered");
			expect(input.getAttribute("type")).toBe("url");
			expect(input.hasAttribute("required")).toBe(true);
		});

		it("redirects GET /view?url=<valid> to /view/<encoded-url>", async () => {
			const { app } = createTestApp();

			const response = await request(app).get(
				`/view?url=${encodeURIComponent(ARTICLE_URL)}`,
			);

			expect(response.status).toBe(302);
			expect(response.headers.location).toBe(`/view/${ENCODED}`);
		});

		it("renders the save-error page when GET /view?url=<invalid>", async () => {
			const { app } = createTestApp();

			const response = await request(app).get("/view?url=not-a-url");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			const meta = doc.querySelector('meta[http-equiv="refresh"]');
			expect(meta?.getAttribute("content")).toBe("5;url=/");
		});

		it("renders a fallback body with the Save action when parseArticle fails on a cache miss", async () => {
			const parseArticle: ParseArticle = async () => ({
				ok: false,
				reason: "blocked",
			});
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			const fallback = doc.querySelector("[data-test-no-content]");
			assert(fallback, "no-content fallback must be rendered");
			const action = ctaAction(doc);
			expect(action.textContent).toBe("Save to My Queue");
		});
	});

	describe("Cache behaviour", () => {
		it("serves cached article without calling parseArticle when metadata AND content are cached", async () => {
			const parseSpy = jest.fn(
				async (_url: string): Promise<ParseArticleResult> => buildParseResult(),
			);
			const { app, articleStore } = createTestApp({ parseArticle: parseSpy });
			await articleStore.saveArticle({
				userId: UserIdSchema.parse("seed-user"),
				url: ARTICLE_URL,
				metadata: {
					title: "Cached Title",
					siteName: "example.com",
					excerpt: "Cached excerpt.",
					wordCount: 200,
					imageUrl: "https://cdn.example.com/cached.jpg",
				},
				estimatedReadTime: MinutesSchema.parse(2),
			});
			await articleStore.writeContent({
				url: ARTICLE_URL,
				content: "<p>Cached body.</p>",
			});

			const response = await request(app).get(`/view/${ENCODED}`);

			expect(response.status).toBe(200);
			expect(parseSpy).not.toHaveBeenCalled();
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-reader-title]")?.textContent).toBe(
				"Cached Title",
			);
			expect(
				doc.querySelector("[data-test-reader-content]")?.innerHTML.trim(),
			).toBe("<p>Cached body.</p>");
		});

		it("uses cached metadata as the fallback body when parseArticle fails and only metadata is cached", async () => {
			const parseSpy = jest.fn(
				async (_url: string): Promise<ParseArticleResult> => ({
					ok: false,
					reason: "blocked",
				}),
			);
			const { app, articleStore } = createTestApp({ parseArticle: parseSpy });
			await articleStore.saveArticle({
				userId: UserIdSchema.parse("seed-user"),
				url: ARTICLE_URL,
				metadata: {
					title: "Cached Only Title",
					siteName: "example.com",
					excerpt: "Cached excerpt.",
					wordCount: 200,
				},
				estimatedReadTime: MinutesSchema.parse(5),
			});

			const response = await request(app).get(`/view/${ENCODED}`);

			expect(response.status).toBe(200);
			expect(parseSpy).toHaveBeenCalledTimes(1);
			const doc = new JSDOM(response.text).window.document;
			const fallback = doc.querySelector("[data-test-no-content]");
			assert(fallback, "no-content fallback must be rendered");
			expect(
				doc.querySelector('meta[property="og:title"]')?.getAttribute("content"),
			).toBe("Cached Only Title Summary | Readplace");
		});

		it("falls back to parseArticle when metadata is cached but content is missing", async () => {
			const parseSpy = jest.fn(
				async (_url: string): Promise<ParseArticleResult> =>
					buildParseResult({
						title: "Fresh Title",
						content: "<p>Fresh body.</p>",
					}),
			);
			const { app, articleStore } = createTestApp({ parseArticle: parseSpy });
			await articleStore.saveArticle({
				userId: UserIdSchema.parse("seed-user"),
				url: ARTICLE_URL,
				metadata: {
					title: "Partial",
					siteName: "example.com",
					excerpt: "Partial excerpt.",
					wordCount: 100,
				},
				estimatedReadTime: MinutesSchema.parse(1),
			});

			const response = await request(app).get(`/view/${ENCODED}`);

			expect(response.status).toBe(200);
			expect(parseSpy).toHaveBeenCalledTimes(1);
			const doc = new JSDOM(response.text).window.document;
			expect(
				doc.querySelector("[data-test-reader-content]")?.innerHTML.trim(),
			).toBe("<p>Fresh body.</p>");
		});
	});

	describe("GET primes the summary pipeline", () => {
		it("calls saveArticleGlobally and publishSaveAnonymousLink on a fresh-parse cache miss", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const publishSaveAnonymousLink = jest.fn(async () => {});
			const { app, articleStore } = createTestApp({ parseArticle, publishSaveAnonymousLink });

			const response = await request(app).get(`/view/${ENCODED}`);

			expect(response.status).toBe(200);
			expect(publishSaveAnonymousLink).toHaveBeenCalledTimes(1);
			expect(publishSaveAnonymousLink).toHaveBeenCalledWith({ url: ARTICLE_URL });
			const cached = await articleStore.findArticleByUrl(ARTICLE_URL);
			expect(cached?.metadata.title).toBe("Hello World");
		});

		it("dispatches SaveAnonymousLinkCommand for an authenticated visitor (no user association, viewing only)", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const publishSaveAnonymousLink = jest.fn(async () => {});
			const { app, auth } = createTestApp({ parseArticle, publishSaveAnonymousLink });
			await auth.createUser({ email: "test@example.com", password: "password123" });
			const agent = request.agent(app);
			await agent
				.post("/login")
				.type("form")
				.send({ email: "test@example.com", password: "password123" });

			const response = await agent.get(`/view/${ENCODED}`);

			expect(response.status).toBe(200);
			expect(publishSaveAnonymousLink).toHaveBeenCalledTimes(1);
			expect(publishSaveAnonymousLink).toHaveBeenCalledWith({ url: ARTICLE_URL });
		});

		it("is idempotent — skips priming when the article is already in the global cache", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const publishSaveAnonymousLink = jest.fn(async () => {});
			const { app, articleStore } = createTestApp({ parseArticle, publishSaveAnonymousLink });
			await articleStore.saveArticleGlobally({
				url: ARTICLE_URL,
				metadata: {
					title: "Cached",
					siteName: "example.com",
					excerpt: "Cached excerpt.",
					wordCount: 200,
				},
				estimatedReadTime: MinutesSchema.parse(2),
			});

			await request(app).get(`/view/${ENCODED}`);

			expect(publishSaveAnonymousLink).not.toHaveBeenCalled();
		});

		it("skips priming when parseArticle fails", async () => {
			const parseArticle: ParseArticle = async () => ({ ok: false, reason: "blocked" });
			const publishSaveAnonymousLink = jest.fn(async () => {});
			const { app } = createTestApp({ parseArticle, publishSaveAnonymousLink });

			await request(app).get(`/view/${ENCODED}`);

			expect(publishSaveAnonymousLink).not.toHaveBeenCalled();
		});

		it("reports parse failures via logParseError with source 'hutch-view'", async () => {
			const parseArticle: ParseArticle = async () => ({ ok: false, reason: "blocked" });
			const logParseError = jest.fn();
			const { app } = createTestApp({ parseArticle, logParseError });

			await request(app).get(`/view/${ENCODED}`);

			expect(logParseError).toHaveBeenCalledWith({
				url: ARTICLE_URL,
				reason: "blocked",
				source: "hutch-view",
			});
		});
	});
});
