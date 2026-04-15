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

describe("Save routes", () => {
	describe("GET /save (no url)", () => {
		it("should redirect unauthenticated user to home", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/save");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/");
		});

		it("should redirect authenticated user to queue", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/save");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});
	});

	describe("GET /save?url=invalid", () => {
		it("should redirect unauthenticated user to home for invalid URL", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/save?url=not-a-url");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/");
		});

		it("should redirect authenticated user to queue for invalid URL", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/save?url=not-a-url");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});
	});

	describe("GET /save?url=https://example.com (unauthenticated)", () => {
		it("should redirect to login with return URL", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/save?url=https://example.com/article");

			expect(response.status).toBe(303);
			const location = response.headers.location;
			expect(location).toContain("/login?return=");
			const returnUrl = decodeURIComponent(location.split("return=")[1]);
			expect(returnUrl).toBe("/save?url=https://example.com/article");
		});
	});

	describe("GET /save?url=https://example.com (authenticated)", () => {
		it("should redirect to queue with url", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/save?url=https://example.com/article");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue?url=https%3A%2F%2Fexample.com%2Farticle");
		});
	});

	describe("login round-trip", () => {
		it("should carry URL through login and redirect to queue with url", async () => {
			const { app, auth } = createTestApp();
			await auth.createUser({ email: "test@example.com", password: "password123" });
			const agent = request.agent(app);

			const saveResponse = await agent.get("/save?url=https://example.com/article");
			expect(saveResponse.status).toBe(303);
			const loginRedirect = saveResponse.headers.location;
			expect(loginRedirect).toContain("/login?return=");

			const returnParam = decodeURIComponent(loginRedirect.split("return=")[1]);
			await agent
				.post(`/login?return=${encodeURIComponent(returnParam)}`)
				.type("form")
				.send({ email: "test@example.com", password: "password123" });

			const postLoginResponse = await agent.get(returnParam);
			expect(postLoginResponse.status).toBe(303);
			expect(postLoginResponse.headers.location).toBe("/queue?url=https%3A%2F%2Fexample.com%2Farticle");
		});
	});

	describe("GET /save with Referer only", () => {
		it("should redirect authenticated user to queue with the referer URL", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent
				.get("/save")
				.set("Referer", "https://publisher.com/article-1");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue?url=https%3A%2F%2Fpublisher.com%2Farticle-1");
		});

		it("should carry the referer URL through login for unauthenticated user", async () => {
			const { app, auth } = createTestApp();
			await auth.createUser({ email: "test@example.com", password: "password123" });
			const agent = request.agent(app);

			const saveResponse = await agent
				.get("/save")
				.set("Referer", "https://publisher.com/article-1");

			expect(saveResponse.status).toBe(303);
			const loginRedirect = saveResponse.headers.location;
			expect(loginRedirect).toContain("/login?return=");

			const returnParam = decodeURIComponent(loginRedirect.split("return=")[1]);
			expect(returnParam).toBe("/save?url=https%3A%2F%2Fpublisher.com%2Farticle-1");

			await agent
				.post(`/login?return=${encodeURIComponent(returnParam)}`)
				.type("form")
				.send({ email: "test@example.com", password: "password123" });

			const postLoginResponse = await agent.get(returnParam);
			expect(postLoginResponse.status).toBe(303);
			expect(postLoginResponse.headers.location).toBe("/queue?url=https%3A%2F%2Fpublisher.com%2Farticle-1");
		});

		it("should ignore an invalid Referer and fall through to the no-url branch", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent.get("/save").set("Referer", "not-a-url");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});
	});

	describe("GET /save with matching url and Referer", () => {
		it("should save the url when ?url= and Referer point to the same article", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent
				.get("/save?url=https://publisher.com/article-1")
				.set("Referer", "https://publisher.com/article-1");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue?url=https%3A%2F%2Fpublisher.com%2Farticle-1");
		});

		it("should normalise trailing slashes when comparing", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent
				.get("/save?url=https://publisher.com/article-1")
				.set("Referer", "https://publisher.com/article-1/");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue?url=https%3A%2F%2Fpublisher.com%2Farticle-1");
		});
	});

	describe("GET /save with url and Referer pointing at different articles", () => {
		it("should prefer the query url when origins differ", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent
				.get("/save?url=https://publisher.com/article-a")
				.set("Referer", "https://other.com/article-b");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue?url=https%3A%2F%2Fpublisher.com%2Farticle-a");
		});

		it("should prefer the query url when paths differ on the same origin", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent
				.get("/save?url=https://publisher.com/article-a")
				.set("Referer", "https://publisher.com/article-b");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue?url=https%3A%2F%2Fpublisher.com%2Farticle-a");
		});

		it("should preserve the query string on the url when it has one", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent
				.get("/save?url=https://publisher.com/article-a%3Futm_source%3Dlinkedin")
				.set("Referer", "https://www.linkedin.com/");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe(
				"/queue?url=https%3A%2F%2Fpublisher.com%2Farticle-a%3Futm_source%3Dlinkedin",
			);
		});
	});

	describe("GET /save with a self-origin Referer", () => {
		it("should ignore the Referer when it points at the app's own host", async () => {
			const { app, auth } = createTestApp();
			const agent = await loginAgent(app, auth);

			const response = await agent
				.get("/save?url=https://publisher.com/article-1")
				.set("Host", "readplace.test")
				.set("Referer", "http://readplace.test/login");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue?url=https%3A%2F%2Fpublisher.com%2Farticle-1");
		});
	});
});
