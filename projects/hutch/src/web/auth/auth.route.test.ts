import { JSDOM } from "jsdom";
import request from "supertest";
import { createTestApp } from "../../test-app";

describe("Auth routes", () => {
	describe("GET /login", () => {
		it("should render the login form", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/login");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector('[data-test-form="login"]')).not.toBeNull();
			expect(doc.querySelector('input[name="email"]')).not.toBeNull();
			expect(doc.querySelector('input[name="password"]')).not.toBeNull();
		});
	});

	describe("POST /login", () => {
		it("should redirect to /queue on valid credentials", async () => {
			const { app, auth } = createTestApp();
			await auth.createUser("test@example.com", "password123");

			const agent = request.agent(app);
			const response = await agent
				.post("/login")
				.type("form")
				.send({ email: "test@example.com", password: "password123" });

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
			expect(response.headers["set-cookie"]).toBeDefined();
		});

		it("should show error on invalid credentials", async () => {
			const { app } = createTestApp();

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

		it("should show validation error for empty email", async () => {
			const { app } = createTestApp();

			const response = await request(app)
				.post("/login")
				.type("form")
				.send({ email: "", password: "password123" });

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector('[data-test-error="email"]')).not.toBeNull();
		});
	});

	describe("GET /signup", () => {
		it("should render the signup form", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/signup");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector('[data-test-form="signup"]')).not.toBeNull();
			expect(doc.querySelector('input[name="confirmPassword"]')).not.toBeNull();
		});
	});

	describe("POST /signup", () => {
		it("should create user and redirect to /queue", async () => {
			const { app } = createTestApp();

			const response = await request(app).post("/signup").type("form").send({
				email: "new@example.com",
				password: "password123",
				confirmPassword: "password123",
			});

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
			expect(response.headers["set-cookie"]).toBeDefined();
		});

		it("should show error for duplicate email", async () => {
			const { app, auth } = createTestApp();
			await auth.createUser("existing@example.com", "password123");

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
			const { app } = createTestApp();

			const response = await request(app).post("/signup").type("form").send({
				email: "new@example.com",
				password: "password123",
				confirmPassword: "differentpassword",
			});

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(
				doc.querySelector('[data-test-error="confirmPassword"]'),
			).not.toBeNull();
		});

		it("should show error for short password", async () => {
			const { app } = createTestApp();

			const response = await request(app).post("/signup").type("form").send({
				email: "new@example.com",
				password: "short",
				confirmPassword: "short",
			});

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector('[data-test-error="password"]')).not.toBeNull();
		});
	});

	describe("POST /logout", () => {
		it("should clear session and redirect to /", async () => {
			const { app, auth } = createTestApp();
			await auth.createUser("test@example.com", "password123");

			const agent = request.agent(app);
			await agent
				.post("/login")
				.type("form")
				.send({ email: "test@example.com", password: "password123" });

			const response = await agent.post("/logout");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/");
		});
	});
});
