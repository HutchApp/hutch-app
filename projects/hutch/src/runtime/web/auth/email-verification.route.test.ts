import { JSDOM } from "jsdom";
import request from "supertest";
import { createTestApp } from "../../test-app";
import { initInMemoryAuth } from "../../providers/auth/in-memory-auth";
import { initInMemoryArticleStore } from "../../providers/article-store/in-memory-article-store";
import { initReadabilityParser } from "../../providers/article-parser/readability-parser";
import type { FetchHtml } from "../../providers/article-parser/readability-parser";
import { initInMemoryEmailVerification } from "../../providers/email-verification/in-memory-email-verification";
import { createOAuthModel, initInMemoryOAuthModel } from "../../providers/oauth/oauth-model";
import { createValidateAccessToken } from "../../providers/oauth/validate-access-token";
import { createApp } from "../../server";

const stubFetchHtml: FetchHtml = async (url) => {
	const hostname = new URL(url).hostname;
	return `<html><head><title>Article from ${hostname}</title></head><body><article><p>Content</p></article></body></html>`;
};

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
			expect(sent[0].from).toContain("hutch@hutch-app.com");
			expect(sent[0].subject).toContain("Verify");
			expect(sent[0].html).toContain("verify-email?token=");
		});

		it("should complete signup even when email sending fails", async () => {
			const auth = initInMemoryAuth();
			const articleStore = initInMemoryArticleStore();
			const parser = initReadabilityParser({ fetchHtml: stubFetchHtml });
			const oauthModel = createOAuthModel(initInMemoryOAuthModel());
			const emailVerification = initInMemoryEmailVerification();

			let resolveErrorLogged: () => void;
			const errorLogged = new Promise<void>((resolve) => {
				resolveErrorLogged = resolve;
			});

			const app = createApp({
				appOrigin: "http://localhost:3000",
				...auth,
				...articleStore,
				...parser,
				...emailVerification,
				sendEmail: async () => { throw new Error("Email service down"); },
				baseUrl: "http://localhost:3000",
				logError: () => { resolveErrorLogged(); },
				oauthModel,
				validateAccessToken: createValidateAccessToken(oauthModel),
			});

			const response = await request(app).post("/signup").type("form").send({
				email: "fail-email@example.com",
				password: "password123",
				confirmPassword: "password123",
			});

			expect(response.status).toBe(303);
			await errorLogged;
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
			expect(doc.querySelector("h1")?.textContent).toBe("Email verified");
		});

		it("should reject an invalid token", async () => {
			const { app } = createTestApp();

			const response = await request(app).get("/verify-email?token=invalidtoken");

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("h1")?.textContent).toBe("Verification failed");
		});

		it("should reject when no token is provided", async () => {
			const { app } = createTestApp();

			const response = await request(app).get("/verify-email");

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("h1")?.textContent).toBe("Verification failed");
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
			expect(doc.querySelector("h1")?.textContent).toBe("Verification failed");
		});

		it("should mark email as verified after successful verification", async () => {
			const { app, auth, email } = createTestApp();

			const signupResponse = await request(app).post("/signup").type("form").send({
				email: "flag@example.com",
				password: "password123",
				confirmPassword: "password123",
			});

			const cookies = signupResponse.headers["set-cookie"];
			const cookieString = Array.isArray(cookies) ? cookies[0] : cookies;
			const sessionMatch = cookieString.match(/hutch_sid=([^;]+)/);
			const sessionId = sessionMatch![1];
			const session = await auth.getSessionUserId(sessionId);

			expect(session!.emailVerified).toBe(false);

			const sent = email.getSentEmails();
			const tokenMatch = sent[0].html.match(/token=([a-f0-9]+)/);
			const token = tokenMatch![1];

			await request(app).get(`/verify-email?token=${token}`).set("Cookie", `hutch_sid=${sessionId}`);

			const updatedSession = await auth.getSessionUserId(sessionId);
			expect(updatedSession!.emailVerified).toBe(true);
		});

		it("should not mark email as verified when token is invalid", async () => {
			const { app, auth } = createTestApp();

			const signupResponse = await request(app).post("/signup").type("form").send({
				email: "noverify@example.com",
				password: "password123",
				confirmPassword: "password123",
			});

			const cookies = signupResponse.headers["set-cookie"];
			const cookieString = Array.isArray(cookies) ? cookies[0] : cookies;
			const sessionMatch = cookieString.match(/hutch_sid=([^;]+)/);
			const sessionId = sessionMatch![1];

			await request(app).get("/verify-email?token=invalidtoken").set("Cookie", `hutch_sid=${sessionId}`);

			const session = await auth.getSessionUserId(sessionId);
			expect(session!.emailVerified).toBe(false);
		});
	});
});
