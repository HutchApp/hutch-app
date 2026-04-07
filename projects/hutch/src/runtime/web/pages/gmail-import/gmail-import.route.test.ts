import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import request from "supertest";
import { createTestApp } from "../../../test-app";

async function loginAgent(
	app: ReturnType<typeof createTestApp>["app"],
	auth: ReturnType<typeof createTestApp>["auth"],
) {
	const result = await auth.createUser({ email: "test@example.com", password: "password123" });
	assert(result.ok);
	const agent = request.agent(app);
	await agent
		.post("/login")
		.type("form")
		.send({ email: "test@example.com", password: "password123" });
	return { agent, userId: result.userId };
}

describe("Gmail Import routes", () => {
	describe("GET /gmail-import (unauthenticated)", () => {
		it("should redirect to /login", async () => {
			const { app } = createTestApp();
			const response = await request(app).get("/gmail-import");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/login");
		});
	});

	describe("GET /gmail-import (authenticated, not connected)", () => {
		it("should render the page with Connect Gmail button", async () => {
			const { app, auth } = createTestApp();
			const { agent } = await loginAgent(app, auth);

			const response = await agent.get("/gmail-import");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("h1")?.textContent).toContain("Gmail Link Import");
			expect(doc.querySelector("[data-test-connect-btn]")?.getAttribute("href")).toBe("/gmail-import/connect");
			expect(doc.querySelector("[data-test-disconnected]")?.textContent?.trim()).toBe("No Gmail account connected.");
			expect(doc.querySelectorAll("[data-test-email-list]").length).toBe(0);
		});
	});

	describe("GET /gmail-import (authenticated, connected)", () => {
		it("should render the email list with checkboxes", async () => {
			const { app, auth, gmailTokenStore } = createTestApp();
			const { agent, userId } = await loginAgent(app, auth);

			await gmailTokenStore.saveGmailTokens({
				userId,
				tokens: { accessToken: "test-access", refreshToken: "test-refresh", expiresAt: Date.now() + 3600000 },
			});

			const response = await agent.get("/gmail-import");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-connected]")?.textContent?.trim()).toBe("Gmail account connected.");
			expect(doc.querySelector("[data-test-email-list]")?.tagName.toLowerCase()).toBe("ul");
			expect(doc.querySelector("[data-test-disconnect-btn]")?.textContent?.trim()).toBe("Disconnect Gmail");
			expect(doc.querySelectorAll("[data-test-connect-btn]").length).toBe(0);
		});

		it("should display email subjects and senders", async () => {
			const { app, auth, gmailTokenStore } = createTestApp();
			const { agent, userId } = await loginAgent(app, auth);

			await gmailTokenStore.saveGmailTokens({
				userId,
				tokens: { accessToken: "test-access", refreshToken: "test-refresh", expiresAt: Date.now() + 3600000 },
			});

			const response = await agent.get("/gmail-import");
			const doc = new JSDOM(response.text).window.document;

			const subjects = Array.from(doc.querySelectorAll("[data-test-email-subject]")).map(el => el.textContent?.trim());
			const senders = Array.from(doc.querySelectorAll("[data-test-email-from]")).map(el => el.textContent?.trim());

			expect(subjects).toContain("Weekly Newsletter");
			expect(subjects).toContain("Your order shipped");
			expect(senders).toContain("newsletter@example.com");
			expect(senders).toContain("orders@shop.com");
		});

		it("should show email count", async () => {
			const { app, auth, gmailTokenStore } = createTestApp();
			const { agent, userId } = await loginAgent(app, auth);

			await gmailTokenStore.saveGmailTokens({
				userId,
				tokens: { accessToken: "test-access", refreshToken: "test-refresh", expiresAt: Date.now() + 3600000 },
			});

			const response = await agent.get("/gmail-import");
			const doc = new JSDOM(response.text).window.document;

			expect(doc.querySelector("[data-test-email-count]")?.textContent).toContain("3 unread emails");
		});

		it("should have checkboxes checked by default", async () => {
			const { app, auth, gmailTokenStore } = createTestApp();
			const { agent, userId } = await loginAgent(app, auth);

			await gmailTokenStore.saveGmailTokens({
				userId,
				tokens: { accessToken: "test-access", refreshToken: "test-refresh", expiresAt: Date.now() + 3600000 },
			});

			const response = await agent.get("/gmail-import");
			const doc = new JSDOM(response.text).window.document;

			const checkboxes = doc.querySelectorAll("[data-test-email-checkbox]");
			expect(checkboxes.length).toBe(3);
			for (const cb of checkboxes) {
				expect(cb.hasAttribute("checked")).toBe(true);
			}
		});

		it("should have select all and deselect all buttons", async () => {
			const { app, auth, gmailTokenStore } = createTestApp();
			const { agent, userId } = await loginAgent(app, auth);

			await gmailTokenStore.saveGmailTokens({
				userId,
				tokens: { accessToken: "test-access", refreshToken: "test-refresh", expiresAt: Date.now() + 3600000 },
			});

			const response = await agent.get("/gmail-import");
			const doc = new JSDOM(response.text).window.document;

			expect(doc.querySelector("[data-test-select-all]")?.textContent?.trim()).toBe("Select All");
			expect(doc.querySelector("[data-test-deselect-all]")?.textContent?.trim()).toBe("Deselect All");
		});
	});

	describe("GET /gmail-import (connected, email fetch fails)", () => {
		it("should render the page without emails when listing fails", async () => {
			const { app, auth, gmailTokenStore } = createTestApp({
				ensureValidAccessToken: async () => { throw new Error("token expired"); },
			});
			const { agent, userId } = await loginAgent(app, auth);

			await gmailTokenStore.saveGmailTokens({
				userId,
				tokens: { accessToken: "test-access", refreshToken: "test-refresh", expiresAt: Date.now() + 3600000 },
			});

			const response = await agent.get("/gmail-import");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-connected]")).not.toBeNull();
			expect(doc.querySelectorAll("[data-test-email-subject]").length).toBe(0);
		});
	});

	describe("GET /gmail-import with status message", () => {
		it("should display the status message", async () => {
			const { app, auth } = createTestApp();
			const { agent } = await loginAgent(app, auth);

			const response = await agent.get("/gmail-import?status=Gmail+connected+successfully");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-status-message]")?.textContent?.trim()).toBe("Gmail connected successfully");
		});

		it("should display dynamic import result status", async () => {
			const { app, auth } = createTestApp();
			const { agent } = await loginAgent(app, auth);

			const response = await agent.get("/gmail-import?status=Imported+5+links+from+3+emails.+2+skipped");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-status-message]")?.textContent?.trim()).toBe("Imported 5 links from 3 emails. 2 skipped");
		});

		it("should ignore unknown status values", async () => {
			const { app, auth } = createTestApp();
			const { agent } = await loginAgent(app, auth);

			const response = await agent.get("/gmail-import?status=malicious+script");

			expect(response.status).toBe(200);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-status-message]")).toBeNull();
		});
	});

	describe("GET /gmail-import/connect", () => {
		it("should redirect to Google OAuth consent URL", async () => {
			const { app, auth } = createTestApp();
			const { agent } = await loginAgent(app, auth);

			const response = await agent.get("/gmail-import/connect");

			expect(response.status).toBe(302);
			expect(response.headers.location).toContain("accounts.google.com/o/oauth2/v2/auth");
			expect(response.headers.location).toContain("client_id=test-google-client-id");
			expect(response.headers.location).toContain("gmail.modify");
		});
	});

	describe("GET /gmail-import/callback", () => {
		it("should redirect with success when code is provided", async () => {
			const { app, auth } = createTestApp();
			const { agent } = await loginAgent(app, auth);

			const response = await agent.get("/gmail-import/callback?code=test-auth-code");

			expect(response.status).toBe(303);
			expect(response.headers.location).toContain("/gmail-import");
			expect(response.headers.location).toContain("connected+successfully");
		});

		it("should redirect with cancellation when no code", async () => {
			const { app, auth } = createTestApp();
			const { agent } = await loginAgent(app, auth);

			const response = await agent.get("/gmail-import/callback");

			expect(response.status).toBe(303);
			expect(response.headers.location).toContain("cancelled");
		});

		it("should redirect with failure when exchange throws", async () => {
			const { app, auth } = createTestApp({
				exchangeGmailCode: async () => { throw new Error("exchange failed"); },
			});
			const { agent } = await loginAgent(app, auth);

			const response = await agent.get("/gmail-import/callback?code=bad-code");

			expect(response.status).toBe(303);
			expect(response.headers.location).toContain("Connection+failed");
		});
	});

	describe("POST /gmail-import/start (unauthenticated)", () => {
		it("should redirect to /login", async () => {
			const { app } = createTestApp();
			const response = await request(app).post("/gmail-import/start");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/login");
		});
	});

	describe("POST /gmail-import/start (no tokens)", () => {
		it("should redirect with error when Gmail not connected", async () => {
			const { app, auth } = createTestApp();
			const { agent } = await loginAgent(app, auth);

			const response = await agent.post("/gmail-import/start");

			expect(response.status).toBe(303);
			expect(response.headers.location).toContain("connect+Gmail+first");
		});
	});

	describe("POST /gmail-import/start (connected, with messageIds)", () => {
		it("should redirect with import started message", async () => {
			const { app, auth, gmailTokenStore } = createTestApp();
			const { agent, userId } = await loginAgent(app, auth);

			await gmailTokenStore.saveGmailTokens({
				userId,
				tokens: { accessToken: "test-access", refreshToken: "test-refresh", expiresAt: Date.now() + 3600000 },
			});

			const response = await agent
				.post("/gmail-import/start")
				.type("form")
				.send({ messageIds: ["msg-1", "msg-2"] });

			expect(response.status).toBe(303);
			expect(response.headers.location).toContain("Imported+0+links+from+2+emails");
		});
	});

	describe("POST /gmail-import/start (connected, single messageId)", () => {
		it("should handle a single messageId string", async () => {
			const { app, auth, gmailTokenStore } = createTestApp();
			const { agent, userId } = await loginAgent(app, auth);

			await gmailTokenStore.saveGmailTokens({
				userId,
				tokens: { accessToken: "test-access", refreshToken: "test-refresh", expiresAt: Date.now() + 3600000 },
			});

			const response = await agent
				.post("/gmail-import/start")
				.type("form")
				.send({ messageIds: "msg-1" });

			expect(response.status).toBe(303);
			expect(response.headers.location).toContain("Imported+0+links+from+1+emails");
		});
	});

	describe("POST /gmail-import/start (connected, import fails)", () => {
		it("should redirect with failure message when import throws", async () => {
			const { app, auth, gmailTokenStore } = createTestApp({
				runGmailImport: async () => { throw new Error("import crashed"); },
			});
			const { agent, userId } = await loginAgent(app, auth);

			await gmailTokenStore.saveGmailTokens({
				userId,
				tokens: { accessToken: "test-access", refreshToken: "test-refresh", expiresAt: Date.now() + 3600000 },
			});

			const response = await agent
				.post("/gmail-import/start")
				.type("form")
				.send({ messageIds: ["msg-1"] });

			expect(response.status).toBe(303);
			expect(response.headers.location).toContain("Import+failed");
		});
	});

	describe("POST /gmail-import/start (connected, no messageIds)", () => {
		it("should redirect with no emails selected message", async () => {
			const { app, auth, gmailTokenStore } = createTestApp();
			const { agent, userId } = await loginAgent(app, auth);

			await gmailTokenStore.saveGmailTokens({
				userId,
				tokens: { accessToken: "test-access", refreshToken: "test-refresh", expiresAt: Date.now() + 3600000 },
			});

			const response = await agent.post("/gmail-import/start").type("form").send({});

			expect(response.status).toBe(303);
			expect(response.headers.location).toContain("No+emails+selected");
		});
	});

	describe("POST /gmail-import/disconnect", () => {
		it("should redirect to /login when unauthenticated", async () => {
			const { app } = createTestApp();
			const response = await request(app).post("/gmail-import/disconnect");

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/login");
		});

		it("should redirect with disconnect message when authenticated", async () => {
			const { app, auth } = createTestApp();
			const { agent } = await loginAgent(app, auth);

			const response = await agent.post("/gmail-import/disconnect");

			expect(response.status).toBe(303);
			expect(response.headers.location).toContain("disconnected");
		});
	});
});
