import { JSDOM } from "jsdom";
import request from "supertest";
import { createTestApp } from "../../../test-app";
import type { RefreshArticleIfStale } from "../../../providers/article-freshness/check-content-freshness";

async function loginAgent(app: ReturnType<typeof createTestApp>["app"], auth: ReturnType<typeof createTestApp>["auth"]) {
	await auth.createUser({ email: "test@example.com", password: "password123" });
	const agent = request.agent(app);
	await agent
		.post("/login")
		.type("form")
		.send({ email: "test@example.com", password: "password123" });
	return agent;
}

describe("Queue routes", () => {
	describe("GET /queue (unauthenticated)", () => {
		it("should redirect to /login", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/queue");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/login");
		});
	});

	describe("GET /queue (authenticated)", () => {
		it("should render the empty queue", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/queue");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-empty-queue]")?.textContent).toContain("empty");
			expect(doc.querySelector('[data-test-form="save-article"]')?.getAttribute("action")).toBe("/queue/save");
		});

		it("should show article count", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/queue");

			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-article-count]")?.textContent).toContain("0");
		});
	});

	describe("POST /queue/save", () => {
		it("should save an article and redirect", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const saveResponse = await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			expect(saveResponse.status).toBe(303);
			expect(saveResponse.headers.location).toBe("/queue");

			const queueResponse = await agent.get("/queue");
			const doc = new JSDOM(queueResponse.text).window.document;
			expect(doc.querySelectorAll(".queue-article").length).toBe(1);
			expect(doc.querySelector("[data-test-empty-queue]")).toBeNull();
		});

		it("should show error for invalid URL", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "not-a-url" });

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-save-error]")?.textContent).toBe("Please enter a valid URL");
		});
	});

	describe("POST /queue/:id/status", () => {
		it("should mark article as read", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const queueResponse = await agent.get("/queue");
			const doc = new JSDOM(queueResponse.text).window.document;
			const articleEl = doc.querySelector("[data-test-article-list] .queue-article");
			const articleId = articleEl?.getAttribute("data-test-article");

			const statusResponse = await agent
				.post(`/queue/${articleId}/status`)
				.type("form")
				.send({ status: "read" });

			expect(statusResponse.status).toBe(303);

			const readResponse = await agent.get("/queue?status=read");
			const readDoc = new JSDOM(readResponse.text).window.document;
			expect(readDoc.querySelectorAll(".queue-article").length).toBe(1);
		});

		it("should redirect preserving queue view state from query params", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const queueResponse = await agent.get("/queue");
			const doc = new JSDOM(queueResponse.text).window.document;
			const articleId = doc.querySelector("[data-test-article-list] .queue-article")?.getAttribute("data-test-article");

			const statusResponse = await agent
				.post(`/queue/${articleId}/status?order=asc`)
				.type("form")
				.send({ status: "read" });

			expect(statusResponse.headers.location).toBe("/queue?order=asc");
		});

		it("should redirect to queue when status value is invalid", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const queueResponse = await agent.get("/queue");
			const doc = new JSDOM(queueResponse.text).window.document;
			const articleId = doc.querySelector("[data-test-article-list] .queue-article")?.getAttribute("data-test-article");

			const statusResponse = await agent
				.post(`/queue/${articleId}/status`)
				.type("form")
				.send({ status: "invalid-status" });

			expect(statusResponse.status).toBe(303);
			expect(statusResponse.headers.location).toBe("/queue");
		});

		it("should redirect without error for malformed article id", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const statusResponse = await agent
				.post("/queue/not-a-valid-hash/status")
				.type("form")
				.send({ status: "read" });

			expect(statusResponse.status).toBe(303);
			expect(statusResponse.headers.location).toBe("/queue");
		});
	});

	describe("POST /queue/:id/delete", () => {
		it("should delete article", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const queueResponse = await agent.get("/queue");
			const doc = new JSDOM(queueResponse.text).window.document;
			const articleEl = doc.querySelector("[data-test-article-list] .queue-article");
			const articleId = articleEl?.getAttribute("data-test-article");

			const deleteResponse = await agent.post(`/queue/${articleId}/delete`);

			expect(deleteResponse.status).toBe(303);

			const afterDeleteResponse = await agent.get("/queue");
			const afterDoc = new JSDOM(afterDeleteResponse.text).window.document;
			expect(afterDoc.querySelector("[data-test-empty-queue]")?.textContent).toContain("empty");
		});

		it("should redirect preserving queue view state from query params", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const queueResponse = await agent.get("/queue");
			const doc = new JSDOM(queueResponse.text).window.document;
			const articleId = doc.querySelector("[data-test-article-list] .queue-article")?.getAttribute("data-test-article");

			const deleteResponse = await agent.post(`/queue/${articleId}/delete?order=asc`);

			expect(deleteResponse.headers.location).toBe("/queue?order=asc");
		});

		it("should redirect without error for malformed article id", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const deleteResponse = await agent.post("/queue/not-a-valid-hash/delete");

			expect(deleteResponse.status).toBe(303);
			expect(deleteResponse.headers.location).toBe("/queue");
		});
	});

	describe("Read status indicators", () => {
		it("should show unread indicator on newly saved articles", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			const article = doc.querySelector(".queue-article");
			expect(article?.classList.contains("queue-article--unread")).toBe(true);
			expect(article?.querySelector(".queue-article__unread-dot")?.getAttribute("aria-label")).toBe("Unread");
		});

		it("should remove unread indicator after marking as read", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const queueResponse = await agent.get("/queue");
			const doc = new JSDOM(queueResponse.text).window.document;
			const articleId = doc.querySelector("[data-test-article-list] .queue-article")?.getAttribute("data-test-article");

			await agent
				.post(`/queue/${articleId}/status`)
				.type("form")
				.send({ status: "read" });

			const afterResponse = await agent.get("/queue?status=read");
			const afterDoc = new JSDOM(afterResponse.text).window.document;
			const readArticle = afterDoc.querySelector(".queue-article");
			expect(readArticle?.classList.contains("queue-article--unread")).toBe(false);
			expect(readArticle?.querySelector(".queue-article__unread-dot")).toBeNull();
		});

		it("should restore unread indicator when marking back as unread", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const queueResponse = await agent.get("/queue");
			const doc = new JSDOM(queueResponse.text).window.document;
			const articleId = doc.querySelector("[data-test-article-list] .queue-article")?.getAttribute("data-test-article");

			await agent
				.post(`/queue/${articleId}/status`)
				.type("form")
				.send({ status: "read" });

			await agent
				.post(`/queue/${articleId}/status`)
				.type("form")
				.send({ status: "unread" });

			const afterResponse = await agent.get("/queue");
			const afterDoc = new JSDOM(afterResponse.text).window.document;
			const unreadArticle = afterDoc.querySelector(".queue-article");
			expect(unreadArticle?.classList.contains("queue-article--unread")).toBe(true);
			expect(unreadArticle?.querySelector(".queue-article__unread-dot")?.getAttribute("aria-label")).toBe("Unread");
		});

		it("should not include htmx attributes on article title links", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			const titleLink = doc.querySelector(".queue-article__title");
			expect(titleLink?.getAttribute("hx-post")).toBeNull();
			expect(titleLink?.getAttribute("hx-vals")).toBeNull();
			expect(titleLink?.getAttribute("hx-swap")).toBeNull();
		});
	});

	describe("Article URL link", () => {
		it("should render site name as a link to the original URL", async () => {
			const fetchHtml = async (_url: string) =>
				`<html><head><meta property="og:site_name" content="Example Blog"></head><body><article><h1>Post</h1><p>Content here.</p></article></body></html>`;

			const { app, auth } = createTestApp({ fetchHtml });
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			const urlLink = doc.querySelector("[data-test-article-url]");
			expect(urlLink?.getAttribute("href")).toBe("https://example.com/article");
			expect(urlLink?.getAttribute("target")).toBe("_blank");
			expect(urlLink?.textContent).toBe("Example Blog");
		});

		it("should not render URL link when siteName is empty", async () => {
			const skipFreshness: RefreshArticleIfStale = async () => ({ action: "skip" });
			const { app, auth } = createTestApp({ refreshArticleIfStale: skipFreshness });
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/existing" });

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-article-url]")).toBeNull();
		});
	});

	describe("Action forms", () => {
		it("should render action forms from view model for each article", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			const actionForms = doc.querySelectorAll(".queue-article__action-form");

			expect(actionForms.length).toBe(2);
			expect(doc.querySelector("[data-test-action='mark-read']")?.textContent).toBe("Read");
			expect(doc.querySelector("[data-test-action='delete']")?.textContent).toBe("×");
		});

		it("should disable htmx boost on the read action form", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			const readForm = doc.querySelector("[data-test-action='mark-read']")?.closest("form");

			expect(readForm?.getAttribute("hx-boost")).toBe("false");
			expect(readForm?.hasAttribute("hx-target")).toBe(false);
			expect(readForm?.hasAttribute("hx-select")).toBe(false);
			expect(readForm?.hasAttribute("hx-swap")).toBe(false);
		});
	});

	describe("Thumbnail", () => {
		it("should render thumbnail when article has og:image", async () => {
			const fetchHtml = async (_url: string) =>
				`<html><head><meta property="og:image" content="https://example.com/thumb.jpg"></head></html>`;

			const { app, auth } = createTestApp({ fetchHtml });
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			const thumbnail = doc.querySelector(".queue-article__thumbnail");
			expect(thumbnail?.getAttribute("src")).toBe(
				"https://example.com/thumb.jpg",
			);
		});

		it("should link thumbnail to reader view when content exists", async () => {
			const articleHtml = `
			<html><head><title>Thumb Article</title><meta property="og:image" content="https://example.com/thumb.jpg"></head>
			<body><article>
				<h1>Thumb Article</h1>
				<p>An article with enough content for readability to parse successfully.</p>
				<p>Additional paragraph with more text to exceed the minimum threshold.</p>
			</article></body></html>`;

			const fetchHtml = async (_url: string) => articleHtml;
			const { app, auth } = createTestApp({ fetchHtml });
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			const thumbnailLink = doc.querySelector(".queue-article__thumbnail")?.closest("a");
			const titleLink = doc.querySelector("[data-test-article-title]");
			expect(thumbnailLink?.getAttribute("href")).toBe(titleLink?.getAttribute("href"));
		});

		it("should not render thumbnail when page has no images", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector(".queue-article__thumbnail")).toBeNull();
		});
	});

	describe("Reader view", () => {
		it("should render saved article content", async () => {
			const articleHtml = `
			<html><head><title>Saved Post</title></head>
			<body><article>
				<h1>Saved Post</h1>
				<p>This is archived content that should survive the original site going down. Enough text for readability.</p>
				<p>A second paragraph with more words for the parser to work with properly.</p>
			</article></body></html>`;

			const fetchHtml = async (_url: string) => articleHtml;
			const { app, auth } = createTestApp({ fetchHtml });
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/saved-post" });

			const queueResponse = await agent.get("/queue");
			const queueDoc = new JSDOM(queueResponse.text).window.document;
			const articleId = queueDoc
				.querySelector("[data-test-article-list] .queue-article")
				?.getAttribute("data-test-article");

			const readerResponse = await agent.get(`/queue/${articleId}/read`);

			expect(readerResponse.status).toBe(200);
			const doc = new JSDOM(readerResponse.text).window.document;
			expect(doc.querySelector("[data-test-reader-content]")?.textContent).toContain("archived content");
			expect(doc.querySelector("[data-test-reader-title]")?.textContent).toBe("Saved Post");
			expect(doc.querySelector("[data-test-back-link]")?.getAttribute("href")).toBe("/queue");
			expect(doc.querySelector("[data-test-original-link]")?.getAttribute("href")).toBe("https://example.com/saved-post");
		});

		it("should mark unread article as read when opening reader", async () => {
			const articleHtml = `
			<html><head><title>Auto Read</title></head>
			<body><article>
				<h1>Auto Read</h1>
				<p>This article should be marked as read when opened in the reader view.</p>
				<p>Additional paragraph with more text to exceed the minimum threshold.</p>
			</article></body></html>`;

			const fetchHtml = async (_url: string) => articleHtml;
			const { app, auth } = createTestApp({ fetchHtml });
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/auto-read" });

			const queueResponse = await agent.get("/queue");
			const queueDoc = new JSDOM(queueResponse.text).window.document;
			const articleId = queueDoc
				.querySelector("[data-test-article-list] .queue-article")
				?.getAttribute("data-test-article");
			const article = queueDoc.querySelector(".queue-article");
			expect(article?.classList.contains("queue-article--unread")).toBe(true);

			await agent.get(`/queue/${articleId}/read`);

			const afterResponse = await agent.get("/queue");
			const afterDoc = new JSDOM(afterResponse.text).window.document;
			expect(afterDoc.querySelectorAll(".queue-article").length).toBe(0);
		});

		it("should redirect to queue for non-existent article", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/queue/nonexistent/read");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});

		it("should redirect unauthenticated users to login", async () => {
			const { app } = createTestApp();

			const response = await request(app).get("/queue/someid/read");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/login");
		});

		it("should link article title to reader view in queue when content exists", async () => {
			const articleHtml = `
			<html><head><title>Content Article</title></head>
			<body><article>
				<h1>Content Article</h1>
				<p>An article with enough content for readability to parse successfully.</p>
				<p>Additional paragraph with more text to exceed the minimum threshold.</p>
			</article></body></html>`;

			const fetchHtml = async (_url: string) => articleHtml;
			const { app, auth } = createTestApp({ fetchHtml });
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/content-article" });

			const queueResponse = await agent.get("/queue");
			const doc = new JSDOM(queueResponse.text).window.document;
			const titleLink = doc.querySelector("[data-test-article-title]");
			expect(titleLink?.getAttribute("href")).toContain("/read");
		});

		it("should display AI summary when cached summary exists", async () => {
			const articleHtml = `
			<html><head><title>Summarized Post</title><meta property="og:site_name" content="Example Blog"></head>
			<body><article>
				<h1>Summarized Post</h1>
				<p>This is archived content that has been saved for later reading and will be summarized.</p>
			</article></body></html>`;

			const fetchHtml = async (_url: string) => articleHtml;
			const findCachedSummary = async () => "Key points from the article distilled into a brief summary.";
			const { app, auth } = createTestApp({ fetchHtml, findCachedSummary });
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/summarized-post" });

			const queueResponse = await agent.get("/queue");
			const queueDoc = new JSDOM(queueResponse.text).window.document;
			const articleId = queueDoc
				.querySelector("[data-test-article-list] .queue-article")
				?.getAttribute("data-test-article");

			const readerResponse = await agent.get(`/queue/${articleId}/read`);
			const doc = new JSDOM(readerResponse.text).window.document;
			expect(doc.querySelector("[data-test-reader-summary]")?.textContent).toContain("Key points from the article");
			expect(doc.querySelector(".reader__summary-label")?.textContent).toBe("TL;DR");
		});

		it("should not display summary block when no cached summary exists", async () => {
			const articleHtml = `
			<html><head><title>No Summary Post</title></head>
			<body><article>
				<h1>No Summary Post</h1>
				<p>Content without a summary generated.</p>
			</article></body></html>`;

			const fetchHtml = async (_url: string) => articleHtml;
			const { app, auth } = createTestApp({ fetchHtml });
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/no-summary-post" });

			const queueResponse = await agent.get("/queue");
			const queueDoc = new JSDOM(queueResponse.text).window.document;
			const articleId = queueDoc
				.querySelector("[data-test-article-list] .queue-article")
				?.getAttribute("data-test-article");

			const readerResponse = await agent.get(`/queue/${articleId}/read`);
			const doc = new JSDOM(readerResponse.text).window.document;
			expect(doc.querySelector("[data-test-reader-summary]")).toBeNull();
		});

		it("should show no-content fallback when article has no extracted content", async () => {
			const fetchHtml = async (_url: string) => "<html><body></body></html>";
			const { app, auth } = createTestApp({ fetchHtml });
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/empty-page" });

			const queueResponse = await agent.get("/queue");
			const queueDoc = new JSDOM(queueResponse.text).window.document;
			const articleId = queueDoc
				.querySelector("[data-test-article-list] .queue-article")
				?.getAttribute("data-test-article");

			const readerResponse = await agent.get(`/queue/${articleId}/read`);
			const doc = new JSDOM(readerResponse.text).window.document;
			expect(doc.querySelector("[data-test-no-content]")?.textContent).toContain("not yet available");
		});
	});

	describe("Parse failure", () => {
		it("should save article without content when fetch fails", async () => {
			const fetchHtml = async (_url: string): Promise<undefined> => undefined;
			const { app, auth } = createTestApp({ fetchHtml });
			const agent = await loginAgent(app, auth);

			const response = await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/broken" });

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});

		it("should show fallback title from hostname when fetch fails", async () => {
			const fetchHtml = async (_url: string): Promise<undefined> => undefined;
			const { app, auth } = createTestApp({ fetchHtml });
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/broken" });

			const queueResponse = await agent.get("/queue");
			const doc = new JSDOM(queueResponse.text).window.document;
			expect(doc.querySelector("[data-test-article-title]")?.textContent).toContain("Article from example.com");
		});

		it("should show no-content template on read page when fetch fails", async () => {
			const fetchHtml = async (_url: string): Promise<undefined> => undefined;
			const { app, auth } = createTestApp({ fetchHtml });
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/broken" });

			const queueResponse = await agent.get("/queue");
			const queueDoc = new JSDOM(queueResponse.text).window.document;
			const articleId = queueDoc
				.querySelector("[data-test-article-list] .queue-article")
				?.getAttribute("data-test-article");

			const readerResponse = await agent.get(`/queue/${articleId}/read`);
			const doc = new JSDOM(readerResponse.text).window.document;
			expect(doc.querySelector("[data-test-no-content]")).not.toBeNull();
		});

		it("should link article title to reader view when article has no content", async () => {
			const fetchHtml = async (_url: string): Promise<undefined> => undefined;
			const { app, auth } = createTestApp({ fetchHtml });
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/broken" });

			const queueResponse = await agent.get("/queue");
			const doc = new JSDOM(queueResponse.text).window.document;
			const titleLink = doc.querySelector("[data-test-article-title]");
			expect(titleLink?.getAttribute("href")).toContain("/read");
		});

		it("should log error when article parsing fails", async () => {
			const fetchHtml = async (_url: string): Promise<undefined> => undefined;
			const logError = jest.fn();
			const { app, auth } = createTestApp({ fetchHtml, logError });
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/broken" });

			expect(logError).toHaveBeenCalledWith(
				expect.stringContaining("[FetchArticle]"),
			);
		});
	});

	describe("Pagination", () => {
		it("should render pagination links when articles span multiple pages", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			for (let i = 0; i < 21; i++) {
				await agent
					.post("/queue/save")
					.type("form")
					.send({ url: `https://example.com/article-${i}` });
			}

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			const pagination = doc.querySelector("[data-test-pagination]");
			expect(pagination?.querySelector(".queue__pagination-link")?.textContent).toContain("Next");
		});

		it("should render previous link on page 2", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			for (let i = 0; i < 21; i++) {
				await agent
					.post("/queue/save")
					.type("form")
					.send({ url: `https://example.com/p-${i}` });
			}

			const response = await agent.get("/queue?page=2");
			const doc = new JSDOM(response.text).window.document;
			const pagination = doc.querySelector("[data-test-pagination]");
			expect(pagination?.querySelector(".queue__pagination-link")?.textContent).toContain("Previous");
		});
	});

	describe("Filter and sort", () => {
		it("should filter by status", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/1" });
			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/2" });

			const unreadResponse = await agent.get("/queue");
			const unreadDoc = new JSDOM(unreadResponse.text).window.document;
			expect(unreadDoc.querySelectorAll(".queue-article").length).toBe(2);

			const readResponse = await agent.get("/queue?status=read");
			const readDoc = new JSDOM(readResponse.text).window.document;
			expect(readDoc.querySelectorAll(".queue-article").length).toBe(0);
		});

		it("should render sort toggle", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-sort]")?.textContent).toContain("first");
		});

		it("should include status in sort toggle URL when on read tab", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/queue?status=read");
			const doc = new JSDOM(response.text).window.document;
			const sortLink = doc.querySelector("[data-test-sort]");
			expect(sortLink?.getAttribute("href")).toContain("status=read");
		});

		it("should toggle sort order from desc to asc", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			const sortLink = doc.querySelector("[data-test-sort]");
			expect(sortLink?.getAttribute("href")).toContain("order=asc");
			expect(sortLink?.textContent).toContain("Newest first");
		});

		it("should toggle sort order from asc to desc", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/queue?order=asc");
			const doc = new JSDOM(response.text).window.document;
			const sortLink = doc.querySelector("[data-test-sort]");
			expect(sortLink?.getAttribute("href")).toBe("/queue");
			expect(sortLink?.textContent).toContain("Oldest first");
		});
	});

	describe("Re-saving a read article marks it unread", () => {
		it("should mark a read article as unread when saved again via form", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/resave" });

			const queueResponse = await agent.get("/queue");
			const doc = new JSDOM(queueResponse.text).window.document;
			const articleId = doc.querySelector("[data-test-article-list] .queue-article")?.getAttribute("data-test-article");

			await agent
				.post(`/queue/${articleId}/status`)
				.type("form")
				.send({ status: "read" });

			const readResponse = await agent.get("/queue?status=read");
			const readDoc = new JSDOM(readResponse.text).window.document;
			expect(readDoc.querySelectorAll(".queue-article").length).toBe(1);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/resave" });

			const afterResave = await agent.get("/queue");
			const afterDoc = new JSDOM(afterResave.text).window.document;
			const article = afterDoc.querySelector(".queue-article");
			expect(article?.classList.contains("queue-article--unread")).toBe(true);

			const afterReadTab = await agent.get("/queue?status=read");
			const afterReadDoc = new JSDOM(afterReadTab.text).window.document;
			expect(afterReadDoc.querySelectorAll(".queue-article").length).toBe(0);
		});
	});

	describe("POST /queue/save with existing article (skip freshness)", () => {
		it("should save user-article relationship without re-fetching", async () => {
			const skipFreshness: RefreshArticleIfStale = async () => ({ action: "skip" });
			const { app, auth } = createTestApp({ refreshArticleIfStale: skipFreshness });
			const agent = await loginAgent(app, auth);

			const response = await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/existing" });

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});

		it("should save for unchanged content (304)", async () => {
			const unchangedFreshness: RefreshArticleIfStale = async () => ({ action: "unchanged" });
			const { app, auth } = createTestApp({ refreshArticleIfStale: unchangedFreshness });
			const agent = await loginAgent(app, auth);

			const response = await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/existing" });

			expect(response.status).toBe(303);
		});

		it("should publish LinkSaved event for refreshed content", async () => {
			let linkSavedPublished = false;
			const refreshedFreshness: RefreshArticleIfStale = async () => ({
				action: "refreshed",
				article: {
					ok: true as const,
					article: {
						title: "Refreshed",
						siteName: "example.com",
						excerpt: "Refreshed excerpt",
						wordCount: 100,
						content: "<p>New content</p>",
					},
				},
			});
			const { app, auth } = createTestApp({
				refreshArticleIfStale: refreshedFreshness,
				publishLinkSaved: async () => { linkSavedPublished = true; },
			});
			const agent = await loginAgent(app, auth);

			const response = await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/existing" });

			expect(response.status).toBe(303);
			expect(linkSavedPublished).toBe(true);
		});
	});

	describe("Unread tab count", () => {
		it("should show unread count on the Unread tab", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent.post("/queue/save").type("form").send({ url: "https://example.com/1" });
			await agent.post("/queue/save").type("form").send({ url: "https://example.com/2" });

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			const unreadTab = doc.querySelector('[data-test-filter="unread"]');
			expect(unreadTab?.textContent).toBe("Unread (2)");
		});

		it("should show unread count when viewing read tab", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent.post("/queue/save").type("form").send({ url: "https://example.com/1" });
			await agent.post("/queue/save").type("form").send({ url: "https://example.com/2" });
			await agent.post("/queue/save").type("form").send({ url: "https://example.com/3" });

			const queueResponse = await agent.get("/queue");
			const doc = new JSDOM(queueResponse.text).window.document;
			const articleId = doc.querySelector("[data-test-article-list] .queue-article")?.getAttribute("data-test-article");
			await agent.post(`/queue/${articleId}/status`).type("form").send({ status: "read" });

			const readResponse = await agent.get("/queue?status=read");
			const readDoc = new JSDOM(readResponse.text).window.document;
			const unreadTab = readDoc.querySelector('[data-test-filter="unread"]');
			expect(unreadTab?.textContent).toBe("Unread (2)");
		});

		it("should not show count on the Read tab", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			const readTab = doc.querySelector('[data-test-filter="read"]');
			expect(readTab?.textContent).toBe("Read");
		});

		it("should show zero unread count on empty queue", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			const unreadTab = doc.querySelector('[data-test-filter="unread"]');
			expect(unreadTab?.textContent).toBe("Unread (0)");
		});
	});

	describe("CORS for browser extensions", () => {
		it("should allow requests from browser extensions", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent
				.get("/queue")
				.set("Origin", "moz-extension://abc123");

			expect(response.status).toBe(200);
			expect(response.headers["access-control-allow-origin"]).toBe("moz-extension://abc123");
		});

		it("should reject requests from non-extension origins", async () => {
			const { app } = createTestApp();

			const response = await request(app)
				.options("/queue")
				.set("Origin", "https://evil.com")
				.set("Access-Control-Request-Method", "GET");

			expect(response.headers["access-control-allow-origin"]).toBeUndefined();
		});
	});

	describe("save article without content", () => {
		it("should save article without publishing link-saved when parse returns no content", async () => {
			let publishCalled = false;
			const { app, auth } = createTestApp({
				parseArticle: async () => ({
					ok: true as const,
					article: {
						title: "No Content",
						siteName: "example.com",
						excerpt: "Test excerpt",
						wordCount: 0,
						content: "",
						imageUrl: undefined,
					},
				}),
				publishLinkSaved: async () => { publishCalled = true; },
			});
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/no-content" });

			expect(publishCalled).toBe(false);
		});
	});
});
