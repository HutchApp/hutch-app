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
	});

	describe("POST /queue/:id/star", () => {
		it("should toggle star on article", async () => {
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

			const starResponse = await agent.post(`/queue/${articleId}/star`);

			expect(starResponse.status).toBe(303);

			const starredResponse = await agent.get("/queue?starred=true");
			const starredDoc = new JSDOM(starredResponse.text).window.document;
			expect(starredDoc.querySelectorAll(".queue-article").length).toBe(1);
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
	});
});
