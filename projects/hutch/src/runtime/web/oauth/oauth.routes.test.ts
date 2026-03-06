import request from "supertest";
import type { Client, Token } from "@node-oauth/oauth2-server";
import { createTestApp } from "../../test-app";
import type { UserId } from "../../domain/user/user.types";

const TEST_USER_ID = "test-user-123" as UserId;
const TEST_CLIENT_ID = "hutch-firefox-extension";
const TEST_REDIRECT_URI = "http://localhost:3000/callback";

describe("OAuth routes", () => {
	describe("GET /oauth/authorize", () => {
		it("redirects to login if not authenticated", async () => {
			const testApp = createTestApp();

			const response = await request(testApp.app).get("/oauth/authorize").query({
				client_id: TEST_CLIENT_ID,
				redirect_uri: TEST_REDIRECT_URI,
				response_type: "code",
				code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
				code_challenge_method: "S256",
			});

			expect(response.status).toBe(303);
			expect(response.headers.location).toContain("/login");
		});

		it("shows authorization form when authenticated", async () => {
			const testApp = createTestApp();
			await testApp.auth.createUser({
				email: "test@example.com",
				password: "password123",
			});

			const agent = request.agent(testApp.app);
			await agent.post("/login").type("form").send({
				email: "test@example.com",
				password: "password123",
			});

			const response = await agent.get("/oauth/authorize").query({
				client_id: TEST_CLIENT_ID,
				redirect_uri: TEST_REDIRECT_URI,
				response_type: "code",
				code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
				code_challenge_method: "S256",
			});

			expect(response.status).toBe(200);
			expect(response.text).toContain("Authorize");
			expect(response.text).toContain("Firefox Extension");
		});

		it("returns 400 for unknown client", async () => {
			const testApp = createTestApp();

			const response = await request(testApp.app).get("/oauth/authorize").query({
				client_id: "unknown-client",
				redirect_uri: TEST_REDIRECT_URI,
				response_type: "code",
				code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
				code_challenge_method: "S256",
			});

			expect(response.status).toBe(400);
			expect(response.body.error).toBe("invalid_client");
		});

		it("returns 400 for invalid redirect_uri", async () => {
			const testApp = createTestApp();

			const response = await request(testApp.app).get("/oauth/authorize").query({
				client_id: TEST_CLIENT_ID,
				redirect_uri: "https://evil.com/callback",
				response_type: "code",
				code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
				code_challenge_method: "S256",
			});

			expect(response.status).toBe(400);
			expect(response.body.error).toBe("invalid_request");
		});

		it("returns 400 for missing parameters", async () => {
			const testApp = createTestApp();

			const response = await request(testApp.app).get("/oauth/authorize").query({
				client_id: TEST_CLIENT_ID,
			});

			expect(response.status).toBe(400);
			expect(response.body.error).toBe("invalid_request");
		});
	});

	describe("POST /oauth/authorize", () => {
		it("returns 401 if not authenticated", async () => {
			const testApp = createTestApp();

			const response = await request(testApp.app)
				.post("/oauth/authorize")
				.type("form")
				.send({
					client_id: TEST_CLIENT_ID,
					redirect_uri: TEST_REDIRECT_URI,
					response_type: "code",
					code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
					code_challenge_method: "S256",
					action: "approve",
				});

			expect(response.status).toBe(401);
		});

		it("redirects with error when denied", async () => {
			const testApp = createTestApp();
			await testApp.auth.createUser({
				email: "test@example.com",
				password: "password123",
			});

			const agent = request.agent(testApp.app);
			await agent.post("/login").type("form").send({
				email: "test@example.com",
				password: "password123",
			});

			const response = await agent
				.post("/oauth/authorize")
				.type("form")
				.send({
					client_id: TEST_CLIENT_ID,
					redirect_uri: TEST_REDIRECT_URI,
					response_type: "code",
					code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
					code_challenge_method: "S256",
					action: "deny",
				});

			expect(response.status).toBe(302);
			expect(response.headers.location).toContain("error=access_denied");
		});

		it("includes state in deny redirect when provided", async () => {
			const testApp = createTestApp();
			await testApp.auth.createUser({
				email: "test@example.com",
				password: "password123",
			});

			const agent = request.agent(testApp.app);
			await agent.post("/login").type("form").send({
				email: "test@example.com",
				password: "password123",
			});

			const response = await agent
				.post("/oauth/authorize")
				.type("form")
				.send({
					client_id: TEST_CLIENT_ID,
					redirect_uri: TEST_REDIRECT_URI,
					response_type: "code",
					code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
					code_challenge_method: "S256",
					state: "test-state-123",
					action: "deny",
				});

			expect(response.status).toBe(302);
			expect(response.headers.location).toContain("state=test-state-123");
		});

		it("returns 400 for deny with invalid redirect_uri (prevents open redirect)", async () => {
			const testApp = createTestApp();
			await testApp.auth.createUser({
				email: "test@example.com",
				password: "password123",
			});

			const agent = request.agent(testApp.app);
			await agent.post("/login").type("form").send({
				email: "test@example.com",
				password: "password123",
			});

			const response = await agent
				.post("/oauth/authorize")
				.type("form")
				.send({
					client_id: TEST_CLIENT_ID,
					redirect_uri: "https://evil.com/callback",
					action: "deny",
				});

			expect(response.status).toBe(400);
			expect(response.body.error).toBe("invalid_request");
		});
	});

	describe("POST /oauth/revoke", () => {
		it("revokes a valid refresh token", async () => {
			const testApp = createTestApp();
			const client = (await testApp.oauthModel.getClient(
				TEST_CLIENT_ID,
				"",
			)) as Client;

			await testApp.oauthModel.saveToken(
				{
					accessToken: "revoke-access",
					accessTokenExpiresAt: new Date(Date.now() + 3600000),
					refreshToken: "revoke-refresh",
					refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600000),
				} as Token,
				client,
				{ id: TEST_USER_ID },
			);

			const response = await request(testApp.app)
				.post("/oauth/revoke")
				.send({ token: "revoke-refresh" });

			expect(response.status).toBe(200);

			const revokedToken = await testApp.oauthModel.getRefreshToken(
				"revoke-refresh",
			);
			expect(revokedToken).toBeNull();
		});

		it("returns 400 without token parameter", async () => {
			const testApp = createTestApp();

			const response = await request(testApp.app)
				.post("/oauth/revoke")
				.send({});

			expect(response.status).toBe(400);
			expect(response.body.error).toBe("invalid_request");
		});

		it("returns 200 for non-existent token (RFC compliance)", async () => {
			const testApp = createTestApp();

			const response = await request(testApp.app)
				.post("/oauth/revoke")
				.send({ token: "non-existent-token" });

			expect(response.status).toBe(200);
		});
	});
});
