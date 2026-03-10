import { JSDOM } from "jsdom";
import request from "supertest";
import { createTestApp } from "../../test-app";

describe("Email verification", () => {
	describe("POST /signup", () => {
		it("should send a verification email on successful signup", async () => {
			const { app, email } = createTestApp();

			await request(app).post("/signup").type("form").send({
				email: "new@example.com",
				password: "password123",
				confirmPassword: "password123",
			});

			const sent = email.getSentEmails();
			expect(sent).toHaveLength(1);
			expect(sent[0].to).toBe("new@example.com");
			expect(sent[0].from).toContain("noreply");
			expect(sent[0].subject).toContain("Verify");
			expect(sent[0].html).toContain("verify-email?token=");
		});

		it("should not send a verification email when signup fails", async () => {
			const { app, auth, email } = createTestApp();
			await auth.createUser({ email: "existing@example.com", password: "password123" });

			await request(app).post("/signup").type("form").send({
				email: "existing@example.com",
				password: "password123",
				confirmPassword: "password123",
			});

			expect(email.getSentEmails()).toHaveLength(0);
		});
	});

	describe("GET /verify-email", () => {
		it("should verify email with a valid token", async () => {
			const { app, email } = createTestApp();

			await request(app).post("/signup").type("form").send({
				email: "verify@example.com",
				password: "password123",
				confirmPassword: "password123",
			});

			const sent = email.getSentEmails();
			const tokenMatch = sent[0].html.match(/token=([a-f0-9]+)/);
			expect(tokenMatch).toBeTruthy();
			const token = tokenMatch![1];

			const verifyResponse = await request(app).get(`/verify-email?token=${token}`);

			expect(verifyResponse.status).toBe(200);
			const doc = new JSDOM(verifyResponse.text).window.document;
			expect(doc.querySelector("[data-test-verify-success]")).toBeTruthy();
		});

		it("should reject an invalid token", async () => {
			const { app } = createTestApp();

			const response = await request(app).get("/verify-email?token=invalidtoken");

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-verify-error]")).toBeTruthy();
		});

		it("should reject when no token is provided", async () => {
			const { app } = createTestApp();

			const response = await request(app).get("/verify-email");

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-verify-error]")).toBeTruthy();
		});

		it("should reject a token that has already been used", async () => {
			const { app, email } = createTestApp();

			await request(app).post("/signup").type("form").send({
				email: "once@example.com",
				password: "password123",
				confirmPassword: "password123",
			});

			const sent = email.getSentEmails();
			const tokenMatch = sent[0].html.match(/token=([a-f0-9]+)/);
			const token = tokenMatch![1];

			await request(app).get(`/verify-email?token=${token}`);
			const secondResponse = await request(app).get(`/verify-email?token=${token}`);

			expect(secondResponse.status).toBe(400);
			const doc = new JSDOM(secondResponse.text).window.document;
			expect(doc.querySelector("[data-test-verify-error]")).toBeTruthy();
		});
	});
});
