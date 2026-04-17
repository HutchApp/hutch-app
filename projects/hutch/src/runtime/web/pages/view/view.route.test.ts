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

		it("renders the Save CTA with the article URL as a hidden input", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			const form = doc.querySelector("[data-test-view-save]");
			assert(form, "save CTA form must be rendered");
			expect(form.getAttribute("action")).toBe("/save");
			const urlInput = form.querySelector('input[name="url"]');
			assert(urlInput, "url hidden input must be rendered");
			expect(urlInput.getAttribute("value")).toBe(ARTICLE_URL);
		});

		it("forwards utm_* query params as hidden inputs on the CTA", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(
				`/view/${ENCODED}?utm_source=medium&utm_campaign=x&foo=bar`,
			);

			const doc = new JSDOM(response.text).window.document;
			const form = doc.querySelector("[data-test-view-save]");
			assert(form, "save CTA form must be rendered");
			const utmSource = form.querySelector('input[name="utm_source"]');
			assert(utmSource, "utm_source hidden input must be rendered");
			expect(utmSource.getAttribute("value")).toBe("medium");
			const utmCampaign = form.querySelector('input[name="utm_campaign"]');
			assert(utmCampaign, "utm_campaign hidden input must be rendered");
			expect(utmCampaign.getAttribute("value")).toBe("x");
			const hiddenNames = Array.from(
				form.querySelectorAll('input[type="hidden"]'),
			).map((el) => el.getAttribute("name"));
			expect(hiddenNames).toEqual(["url", "utm_source", "utm_campaign"]);
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

		it("returns 404 for GET /view without a path param", async () => {
			const { app } = createTestApp();

			const response = await request(app).get("/view");

			expect(response.status).toBe(404);
		});

		it("renders a fallback body with Save CTA when parseArticle fails on a cache miss", async () => {
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
			const form = doc.querySelector("[data-test-view-save]");
			assert(form, "save CTA must still be rendered when parse fails");
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

	describe("GET has no side effects", () => {
		it("does not call publishLinkSaved on a fresh-parse cache miss", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const publishLinkSaved = jest.fn(async () => {});
			const { app, articleStore } = createTestApp({ parseArticle, publishLinkSaved });

			await request(app).get(`/view/${ENCODED}`);

			expect(publishLinkSaved).not.toHaveBeenCalled();
			expect(await articleStore.findArticleByUrl(ARTICLE_URL)).toBeNull();
		});

		it("renders the prime form with data-auto-submit on a cache miss", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app } = createTestApp({ parseArticle });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			const form = doc.querySelector("[data-test-view-prime]");
			assert(form, "prime form must be rendered");
			expect(form.hasAttribute("data-auto-submit")).toBe(true);
			expect(form.getAttribute("action")).toBe("/view/prime");
			expect(form.getAttribute("method")?.toLowerCase()).toBe("post");
			const urlInput = form.querySelector('input[name="url"]');
			assert(urlInput, "url hidden input must be rendered");
			expect(urlInput.getAttribute("value")).toBe(ARTICLE_URL);
		});

		it("renders the prime form without data-auto-submit when the article is already cached", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const { app, articleStore } = createTestApp({ parseArticle });
			await articleStore.saveArticle({
				userId: UserIdSchema.parse("seed-user"),
				url: ARTICLE_URL,
				metadata: {
					title: "Cached",
					siteName: "example.com",
					excerpt: "Cached excerpt.",
					wordCount: 200,
				},
				estimatedReadTime: MinutesSchema.parse(2),
			});
			await articleStore.writeContent({ url: ARTICLE_URL, content: "<p>Cached body.</p>" });

			const response = await request(app).get(`/view/${ENCODED}`);

			const doc = new JSDOM(response.text).window.document;
			const form = doc.querySelector("[data-test-view-prime]");
			assert(form, "prime form must be rendered");
			expect(form.hasAttribute("data-auto-submit")).toBe(false);
		});
	});

	describe("POST /view/prime", () => {
		it("dispatches SaveLinkCommand with empty userId for an anonymous visitor", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const publishLinkSaved = jest.fn(async () => {});
			const { app, articleStore } = createTestApp({ parseArticle, publishLinkSaved });

			const response = await request(app)
				.post("/view/prime")
				.type("form")
				.send({ url: ARTICLE_URL });

			expect(response.status).toBe(204);
			expect(publishLinkSaved).toHaveBeenCalledTimes(1);
			expect(publishLinkSaved).toHaveBeenCalledWith({ url: ARTICLE_URL, userId: "" });
			const cached = await articleStore.findArticleByUrl(ARTICLE_URL);
			expect(cached?.metadata.title).toBe("Hello World");
		});

		it("dispatches SaveLinkCommand with the session userId for an authenticated visitor", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const captured: Array<{ url: string; userId: string }> = [];
			const publishLinkSaved = async (params: { url: string; userId: string }) => {
				captured.push(params);
			};
			const { app, auth } = createTestApp({ parseArticle, publishLinkSaved });
			await auth.createUser({ email: "test@example.com", password: "password123" });
			const agent = request.agent(app);
			await agent
				.post("/login")
				.type("form")
				.send({ email: "test@example.com", password: "password123" });

			const response = await agent
				.post("/view/prime")
				.type("form")
				.send({ url: ARTICLE_URL });

			expect(response.status).toBe(204);
			expect(captured.length).toBe(1);
			const [call] = captured;
			assert(call, "publishLinkSaved must have been called");
			expect(call.url).toBe(ARTICLE_URL);
			expect(call.userId).not.toBe("");
		});

		it("is idempotent — skips dispatch when the article is already in the global cache", async () => {
			const parseArticle: ParseArticle = async () => buildParseResult();
			const publishLinkSaved = jest.fn(async () => {});
			const { app, articleStore } = createTestApp({ parseArticle, publishLinkSaved });
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

			const response = await request(app)
				.post("/view/prime")
				.type("form")
				.send({ url: ARTICLE_URL });

			expect(response.status).toBe(204);
			expect(publishLinkSaved).not.toHaveBeenCalled();
		});

		it("skips dispatch when parsing fails", async () => {
			const parseArticle: ParseArticle = async () => ({ ok: false, reason: "blocked" });
			const publishLinkSaved = jest.fn(async () => {});
			const { app } = createTestApp({ parseArticle, publishLinkSaved });

			const response = await request(app)
				.post("/view/prime")
				.type("form")
				.send({ url: ARTICLE_URL });

			expect(response.status).toBe(204);
			expect(publishLinkSaved).not.toHaveBeenCalled();
		});

		it("returns 400 when the body has no valid url", async () => {
			const publishLinkSaved = jest.fn(async () => {});
			const { app } = createTestApp({ publishLinkSaved });

			const response = await request(app)
				.post("/view/prime")
				.type("form")
				.send({ url: "not-a-url" });

			expect(response.status).toBe(400);
			expect(publishLinkSaved).not.toHaveBeenCalled();
		});
	});
});
