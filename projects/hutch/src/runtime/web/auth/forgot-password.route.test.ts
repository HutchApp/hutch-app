import { JSDOM } from "jsdom";
import request from "supertest";
import { createTestApp } from "../../test-app";

describe("Forgot password routes", () => {
	describe("GET /forgot-password", () => {
		it("should render the forgot password form", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/forgot-password");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(
				doc
					.querySelector('[data-test-form="forgot-password"]')
					?.getAttribute("action"),
			).toBe("/forgot-password");
			expect(
				doc.querySelector('input[name="email"]')?.getAttribute("type"),
			).toBe("email");
		});
	});

	describe("POST /forgot-password", () => {
		it("should show success message for existing user", async () => {
			const { app, auth } = createTestApp();
			await auth.createUser({
				email: "test@example.com",
				password: "password123",
			});

			const response = await request(app)
				.post("/forgot-password")
				.type("form")
				.send({ email: "test@example.com" });

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-success]")).toBeTruthy();
		});

		it("should send email with reset link for existing user", async () => {
			const { app, auth, email } = createTestApp();
			await auth.createUser({
				email: "test@example.com",
				password: "password123",
			});

			await request(app)
				.post("/forgot-password")
				.type("form")
				.send({ email: "test@example.com" });

			expect(email.sentEmails).toHaveLength(1);
			expect(email.sentEmails[0].to).toBe("test@example.com");
			expect(email.sentEmails[0].subject).toContain("Reset your Hutch password");
			expect(email.sentEmails[0].html).toContain("/reset-password?token=");
		});

		it("should show success even for non-existing user", async () => {
			const { app, email } = createTestApp();

			const response = await request(app)
				.post("/forgot-password")
				.type("form")
				.send({ email: "nonexistent@example.com" });

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-success]")).toBeTruthy();
			expect(email.sentEmails).toHaveLength(0);
		});

		it("should show validation error for invalid email", async () => {
			const { app } = createTestApp();

			const response = await request(app)
				.post("/forgot-password")
				.type("form")
				.send({ email: "" });

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(
				doc.querySelector('[data-test-error="email"]')?.textContent,
			).toBe("Please enter a valid email address");
		});
	});

	describe("GET /reset-password", () => {
		it("should render reset password form with token", async () => {
			const { app } = createTestApp();
			const response = await request(app).get(
				"/reset-password?token=sometoken",
			);

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(
				doc
					.querySelector('[data-test-form="reset-password"]')
					?.getAttribute("action"),
			).toBe("/reset-password");
			expect(
				doc
					.querySelector('input[name="token"]')
					?.getAttribute("value"),
			).toBe("sometoken");
		});

		it("should redirect to forgot-password when no token provided", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/reset-password");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/forgot-password");
		});
	});

	describe("POST /reset-password", () => {
		it("should reset password and redirect to login", async () => {
			const { app, auth, email } = createTestApp();
			await auth.createUser({
				email: "test@example.com",
				password: "oldpassword1",
			});

			await request(app)
				.post("/forgot-password")
				.type("form")
				.send({ email: "test@example.com" });

			const resetUrl = email.sentEmails[0].html.match(
				/reset-password\?token=([a-f0-9]+)/,
			);
			const token = resetUrl![1];

			const response = await request(app)
				.post("/reset-password")
				.type("form")
				.send({
					token,
					password: "newpassword1",
					confirmPassword: "newpassword1",
				});

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/login");

			const loginResponse = await request(app)
				.post("/login")
				.type("form")
				.send({ email: "test@example.com", password: "newpassword1" });
			expect(loginResponse.status).toBe(303);
			expect(loginResponse.headers.location).toBe("/queue");
		});

		it("should show error for invalid token", async () => {
			const { app } = createTestApp();

			const response = await request(app)
				.post("/reset-password")
				.type("form")
				.send({
					token: "invalidtoken",
					password: "newpassword1",
					confirmPassword: "newpassword1",
				});

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(
				doc.querySelector("[data-test-global-error]")?.textContent,
			).toContain("invalid or has expired");
		});

		it("should show validation error for mismatched passwords", async () => {
			const { app } = createTestApp();

			const response = await request(app)
				.post("/reset-password")
				.type("form")
				.send({
					token: "sometoken",
					password: "newpassword1",
					confirmPassword: "different123",
				});

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(
				doc.querySelector('[data-test-error="confirmPassword"]')
					?.textContent,
			).toBe("Passwords do not match");
		});

		it("should show validation error for short password", async () => {
			const { app } = createTestApp();

			const response = await request(app)
				.post("/reset-password")
				.type("form")
				.send({
					token: "sometoken",
					password: "short",
					confirmPassword: "short",
				});

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(
				doc.querySelector('[data-test-error="password"]')?.textContent,
			).toBe("Password must be at least 8 characters");
		});
	});
});

describe("Login page", () => {
	it("should have a forgot password link", async () => {
		const { app } = createTestApp();
		const response = await request(app).get("/login");

		const doc = new JSDOM(response.text).window.document;
		const forgotLink = doc.querySelector('a[href="/forgot-password"]');
		expect(forgotLink).toBeTruthy();
		expect(forgotLink?.textContent).toContain("Forgot your password?");
	});
});
