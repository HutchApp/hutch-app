import { JSDOM } from "jsdom";
import request from "supertest";
import { createTestApp } from "../../../test-app";

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
				.post(`/queue/${articleId}/status?order=asc&status=unread`)
				.type("form")
				.send({ status: "read" });

			expect(statusResponse.headers.location).toBe("/queue?status=unread&order=asc");
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

			const deleteResponse = await agent.post(`/queue/${articleId}/delete?order=asc&status=unread`);

			expect(deleteResponse.headers.location).toBe("/queue?status=unread&order=asc");
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

		it("should include data-article-id attribute for mark-as-read on click", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			const article = doc.querySelector(".queue-article");
			const articleId = article?.getAttribute("data-test-article");
			expect(article?.getAttribute("data-article-id")).toBe(articleId);
		});

		it("should include mark-as-read script on queue page", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			const scripts = Array.from(doc.querySelectorAll("script"));
			const markReadScript = scripts.find(
				(s) =>
					s.textContent?.includes("queue-article--unread") &&
					s.textContent?.includes("status=read") &&
					s.textContent?.includes("data-article-id"),
			);
			expect(markReadScript).toBeTruthy();
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

			expect(actionForms.length).toBe(3);
			expect(doc.querySelector("[data-test-action='mark-read']")?.textContent).toBe("Read");
			expect(doc.querySelector("[data-test-action='archive']")?.textContent).toBe("Archive");
			expect(doc.querySelector("[data-test-action='delete']")?.textContent).toBe("×");
		});
	});

	describe("Show URL toggle", () => {
		it("should not show article URLs by default", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-article-url]")).toBeNull();
		});

		it("should show article URLs when showUrl=true", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/article" });

			const response = await agent.get("/queue?showUrl=true");
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-article-url]")?.textContent).toBe("https://example.com/article");
		});

		it("should render Show URLs toggle link", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/queue");
			const doc = new JSDOM(response.text).window.document;
			const toggle = doc.querySelector("[data-test-show-url]");
			expect(toggle?.textContent).toBe("Show URLs");
			expect(toggle?.getAttribute("href")).toContain("showUrl=true");
		});

		it("should render Hide URLs toggle link when URLs are shown", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/queue?showUrl=true");
			const doc = new JSDOM(response.text).window.document;
			const toggle = doc.querySelector("[data-test-show-url]");
			expect(toggle?.textContent).toBe("Hide URLs");
			expect(toggle?.getAttribute("href")).toBe("/queue");
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
			expect(doc.querySelector("[data-test-no-content]")?.textContent).toContain("not available");
		});
	});

	describe("Parse failure", () => {
		it("should show error when article parsing fails", async () => {
			const fetchHtml = async (_url: string): Promise<undefined> => undefined;
			const { app, auth } = createTestApp({ fetchHtml });
			const agent = await loginAgent(app, auth);

			const response = await agent
				.post("/queue/save")
				.type("form")
				.send({ url: "https://example.com/broken" });

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-save-error]")?.textContent).toContain("Could not parse article");
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

			const allResponse = await agent.get("/queue");
			const allDoc = new JSDOM(allResponse.text).window.document;
			expect(allDoc.querySelectorAll(".queue-article").length).toBe(2);

			const unreadResponse = await agent.get("/queue?status=unread");
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

		it("should include status in sort toggle URL when filter is active", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/queue?status=unread");
			const doc = new JSDOM(response.text).window.document;
			const sortLink = doc.querySelector("[data-test-sort]");
			expect(sortLink?.getAttribute("href")).toContain("status=unread");
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
			expect(sortLink?.getAttribute("href")).toContain("order=desc");
			expect(sortLink?.textContent).toContain("Oldest first");
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
});
