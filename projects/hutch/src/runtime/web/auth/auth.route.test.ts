import assert from "node:assert/strict";
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
			expect(doc.querySelector('[data-test-form="login"]')?.getAttribute("action")).toBe("/login");
			expect(doc.querySelector('input[name="email"]')?.getAttribute("type")).toBe("email");
			expect(doc.querySelector('input[name="password"]')?.getAttribute("type")).toBe("password");
		});

		it("should redirect authenticated user to /queue", async () => {
			const { app, auth } = createTestApp();
			await auth.createUser({ email: "test@example.com", password: "password123" });

			const agent = request.agent(app);
			await agent.post("/login").type("form").send({ email: "test@example.com", password: "password123" });

			const response = await agent.get("/login");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});

		it("should include return URL in form action when provided", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/login?return=%2Foauth%2Fauthorize%3Fclient_id%3Dtest");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			const action = doc.querySelector('[data-test-form="login"]')?.getAttribute("action");
			expect(action).toContain("/login?return=");
		});

		it("should pass return URL to signup link", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/login?return=%2Foauth%2Fauthorize%3Fclient_id%3Dtest");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			const signupLink = doc.querySelector(".auth-card__footer:not(.auth-card__footer--forgot) a")?.getAttribute("href");
			expect(signupLink).toContain("/signup?return=");
		});
	});

	describe("POST /login", () => {
		it("should redirect to /queue on valid credentials", async () => {
			const { app, auth } = createTestApp();
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

		it("should redirect to return URL after successful login", async () => {
			const { app, auth } = createTestApp();
			await auth.createUser({ email: "test@example.com", password: "password123" });

			const response = await request(app)
				.post("/login?return=%2Foauth%2Fauthorize%3Fclient_id%3Dtest")
				.type("form")
				.send({ email: "test@example.com", password: "password123" });

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/oauth/authorize?client_id=test");
		});

		it("should ignore protocol-relative return URLs", async () => {
			const { app, auth } = createTestApp();
			await auth.createUser({ email: "test@example.com", password: "password123" });

			const response = await request(app)
				.post("/login?return=%2F%2Fevil.com")
				.type("form")
				.send({ email: "test@example.com", password: "password123" });

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});

		it("should ignore non-relative return URLs", async () => {
			const { app, auth } = createTestApp();
			await auth.createUser({ email: "test@example.com", password: "password123" });

			const response = await request(app)
				.post("/login?return=https%3A%2F%2Fevil.com")
				.type("form")
				.send({ email: "test@example.com", password: "password123" });

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});

		it("should show validation error for empty email", async () => {
			const { app } = createTestApp();

			const response = await request(app)
				.post("/login")
				.type("form")
				.send({ email: "", password: "password123" });

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector('[data-test-error="email"]')?.textContent).toBe("Please enter a valid email address");
		});

		it("should preserve return URL in form action after invalid credentials", async () => {
			const { app } = createTestApp();

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
			const { app } = createTestApp();

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
			const { app } = createTestApp();
			const response = await request(app).get("/signup");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector('[data-test-form="signup"]')?.getAttribute("action")).toBe("/signup");
			expect(doc.querySelector('input[name="confirmPassword"]')?.getAttribute("type")).toBe("password");
		});

		it("should redirect authenticated user to /queue", async () => {
			const { app, auth } = createTestApp();
			await auth.createUser({ email: "test@example.com", password: "password123" });

			const agent = request.agent(app);
			await agent.post("/login").type("form").send({ email: "test@example.com", password: "password123" });

			const response = await agent.get("/signup");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});

		it("should include return URL in form action when provided", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/signup?return=%2Foauth%2Fauthorize%3Fclient_id%3Dtest");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			const action = doc.querySelector('[data-test-form="signup"]')?.getAttribute("action");
			expect(action).toContain("/signup?return=");
		});

		it("should pass return URL to login link", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/signup?return=%2Foauth%2Fauthorize%3Fclient_id%3Dtest");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			const loginLink = doc.querySelector(".auth-card__footer a")?.getAttribute("href");
			expect(loginLink).toContain("/login?return=");
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
			expect(response.headers["set-cookie"].length).toBeGreaterThan(0);
		});

		it("should redirect to return URL after successful signup", async () => {
			const { app } = createTestApp();

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
			const { app } = createTestApp();

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
			const { app } = createTestApp();

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
			const { app, auth } = createTestApp();
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
			const { app } = createTestApp();

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
			const { app } = createTestApp();

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
			const { app, auth } = createTestApp();
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
			const { app } = createTestApp();

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
			const { app } = createTestApp();
			const response = await request(app).get("/verify-email");

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector(".auth-card__subtitle")?.textContent).toContain(
				"No verification token provided",
			);
		});

		it("should show error for invalid token", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/verify-email?token=invalid-token");

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector(".auth-card__subtitle")?.textContent).toContain(
				"invalid or has already been used",
			);
		});

		it("should verify email with valid token", async () => {
			const { app, auth, emailVerification } = createTestApp();
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
			const { app, auth, emailVerification } = createTestApp();
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
			const { app, auth } = createTestApp();
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
			const { app } = createTestApp();

			const response = await request(app).post("/logout");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/");
		});
	});

	describe("feature=google-login toggle", () => {
		function getGoogleSection(html: string) {
			const doc = new JSDOM(html).window.document;
			const section = doc.querySelector("[data-test-google-section]");
			assert(section, "google section must be rendered");
			return section;
		}

		it("should hide Continue with Google on /login by default", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/login");

			const section = getGoogleSection(response.text);
			expect(section.classList.contains("auth-google-section--hidden")).toBe(true);
		});

		it("should show Continue with Google on /login when feature=google-login", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/login?feature=google-login");

			const section = getGoogleSection(response.text);
			expect(section.classList.contains("auth-google-section--hidden")).toBe(false);
			const googleLink = section.querySelector(".auth-google-button");
			assert(googleLink, "google button must be rendered");
			expect(googleLink.getAttribute("href")).toBe("/auth/google");
			expect(googleLink.textContent).toBe("Continue with Google");
		});

		it("should pass return URL through to the Continue with Google link", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/login?feature=google-login&return=%2Fsave%3Furl%3Dhttps%253A%252F%252Fexample.com");

			const section = getGoogleSection(response.text);
			const googleLink = section.querySelector(".auth-google-button");
			assert(googleLink, "google button must be rendered");
			expect(googleLink.getAttribute("href")).toContain("/auth/google?return=");
		});

		it("should keep Continue with Google visible through invalid-credentials on POST /login", async () => {
			const { app } = createTestApp();
			const response = await request(app)
				.post("/login?feature=google-login")
				.type("form")
				.send({ email: "test@example.com", password: "wrongpassword" });

			expect(response.status).toBe(422);
			const section = getGoogleSection(response.text);
			expect(section.classList.contains("auth-google-section--hidden")).toBe(false);
		});

		it("should keep Continue with Google visible through a validation error on POST /login", async () => {
			const { app } = createTestApp();
			const response = await request(app)
				.post("/login?feature=google-login")
				.type("form")
				.send({ email: "", password: "password123" });

			expect(response.status).toBe(422);
			const section = getGoogleSection(response.text);
			expect(section.classList.contains("auth-google-section--hidden")).toBe(false);
		});

		it("should hide Continue with Google on /signup by default", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/signup");

			const section = getGoogleSection(response.text);
			expect(section.classList.contains("auth-google-section--hidden")).toBe(true);
		});

		it("should show Continue with Google on /signup when feature=google-login", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/signup?feature=google-login");

			const section = getGoogleSection(response.text);
			expect(section.classList.contains("auth-google-section--hidden")).toBe(false);
			const googleLink = section.querySelector(".auth-google-button");
			assert(googleLink, "google button must be rendered");
			expect(googleLink.getAttribute("href")).toBe("/auth/google");
		});

		it("should keep Continue with Google visible through duplicate email error on POST /signup", async () => {
			const { app, auth } = createTestApp();
			await auth.createUser({ email: "taken@example.com", password: "password123" });
			const response = await request(app)
				.post("/signup?feature=google-login")
				.type("form")
				.send({ email: "taken@example.com", password: "password123", confirmPassword: "password123" });

			expect(response.status).toBe(422);
			const section = getGoogleSection(response.text);
			expect(section.classList.contains("auth-google-section--hidden")).toBe(false);
		});

		it("should keep Continue with Google visible through validation error on POST /signup", async () => {
			const { app } = createTestApp();
			const response = await request(app)
				.post("/signup?feature=google-login")
				.type("form")
				.send({ email: "new@example.com", password: "short", confirmPassword: "short" });

			expect(response.status).toBe(422);
			const section = getGoogleSection(response.text);
			expect(section.classList.contains("auth-google-section--hidden")).toBe(false);
		});
	});
});
