import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { JSDOM } from "jsdom";
import request from "supertest";
import { createTestApp } from "../../test-app";
import { GoogleIdSchema } from "../../providers/google-auth/google-auth.schema";
import type { ExchangeGoogleCode } from "../../providers/google-auth/google-token.types";

const TEST_CLIENT_ID = "test-google-client-id";
const TEST_CLIENT_SECRET = "test-google-client-secret";

function signState(payload: object, secret: string = TEST_CLIENT_SECRET): string {
	const raw = JSON.stringify(payload);
	const mac = createHmac("sha256", secret).update(raw).digest("base64url");
	return `${raw}.${mac}`;
}

function cookiesFrom(response: { headers: Record<string, string | string[] | undefined> }): string[] {
	const raw = response.headers["set-cookie"];
	if (!raw) return [];
	return Array.isArray(raw) ? raw : [raw];
}

function stubExchange(overrides?: Partial<Awaited<ReturnType<ExchangeGoogleCode>>>): ExchangeGoogleCode {
	return async () => ({
		googleId: GoogleIdSchema.parse("google-sub-123"),
		email: "google@example.com",
		emailVerified: true,
		...overrides,
	});
}

function freshState(overrides?: { returnUrl?: string }) {
	return { nonce: "test-nonce", returnUrl: overrides?.returnUrl, createdAt: Date.now() };
}

describe("Google auth routes", () => {
	describe("GET /auth/google", () => {
		it("should redirect to Google with correct params and set state cookie", async () => {
			const { app } = createTestApp({ exchangeGoogleCode: stubExchange() });
			const response = await request(app).get("/auth/google");

			expect(response.status).toBe(303);
			const location = new URL(response.headers.location);
			expect(location.origin).toBe("https://accounts.google.com");
			expect(location.pathname).toBe("/o/oauth2/v2/auth");
			expect(location.searchParams.get("client_id")).toBe(TEST_CLIENT_ID);
			expect(location.searchParams.get("response_type")).toBe("code");
			expect(location.searchParams.get("scope")).toBe("openid email");
			expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:3000/auth/google/callback");
			expect(cookiesFrom(response).join(";")).toContain("hutch_gstate=");
		});

	});

	describe("GET /auth/google/callback", () => {
		it("should 400 when required params are missing", async () => {
			const { app } = createTestApp({ exchangeGoogleCode: stubExchange() });
			const response = await request(app).get("/auth/google/callback");

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-global-error]")?.textContent).toContain("Google sign-in failed");
		});

		it("should 400 when state cookie is missing", async () => {
			const { app } = createTestApp({ exchangeGoogleCode: stubExchange() });
			const response = await request(app)
				.get("/auth/google/callback?code=test-code&state=something");

			expect(response.status).toBe(400);
		});

		it("should 400 when state cookie does not match state param", async () => {
			const { app } = createTestApp({ exchangeGoogleCode: stubExchange() });
			const state = signState(freshState());
			const response = await request(app)
				.get(`/auth/google/callback?code=test-code&state=${encodeURIComponent(state)}`)
				.set("Cookie", "hutch_gstate=different-value");

			expect(response.status).toBe(400);
		});

		it("should 400 when state signature is tampered", async () => {
			const { app } = createTestApp({ exchangeGoogleCode: stubExchange() });
			const valid = signState(freshState());
			const tampered = `${valid.slice(0, -4)}XXXX`;
			const response = await request(app)
				.get(`/auth/google/callback?code=test-code&state=${encodeURIComponent(tampered)}`)
				.set("Cookie", `hutch_gstate=${encodeURIComponent(tampered)}`);

			expect(response.status).toBe(400);
		});

		it("should 400 when state is expired", async () => {
			const { app } = createTestApp({ exchangeGoogleCode: stubExchange() });
			const expiredState = signState({ nonce: "n", createdAt: Date.now() - 10 * 60 * 1000 });
			const response = await request(app)
				.get(`/auth/google/callback?code=test-code&state=${encodeURIComponent(expiredState)}`)
				.set("Cookie", `hutch_gstate=${encodeURIComponent(expiredState)}`);

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-global-error]")?.textContent).toContain("expired");
		});

		it("should 400 when token exchange throws", async () => {
			const errors: string[] = [];
			const { app } = createTestApp({
				exchangeGoogleCode: async () => { throw new Error("network down"); },
				logError: (msg) => { errors.push(msg); },
			});
			const state = signState(freshState());
			const response = await request(app)
				.get(`/auth/google/callback?code=test-code&state=${encodeURIComponent(state)}`)
				.set("Cookie", `hutch_gstate=${encodeURIComponent(state)}`);

			expect(response.status).toBe(400);
			expect(errors[0]).toContain("Token exchange failed");
		});

		it("should 400 when Google email is not verified", async () => {
			const { app } = createTestApp({ exchangeGoogleCode: stubExchange({ emailVerified: false }) });
			const state = signState(freshState());
			const response = await request(app)
				.get(`/auth/google/callback?code=test-code&state=${encodeURIComponent(state)}`)
				.set("Cookie", `hutch_gstate=${encodeURIComponent(state)}`);

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-global-error]")?.textContent).toContain("not verified");
		});

		it("should create a new user and redirect to /queue by default", async () => {
			const { app, auth } = createTestApp({
				exchangeGoogleCode: stubExchange({ email: "brand-new@example.com" }),
			});
			const state = signState(freshState());

			const response = await request(app)
				.get(`/auth/google/callback?code=test-code&state=${encodeURIComponent(state)}`)
				.set("Cookie", `hutch_gstate=${encodeURIComponent(state)}`);

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
			expect(cookiesFrom(response).join(";")).toContain("hutch_sid=");

			const lookup = await auth.findUserByEmail("brand-new@example.com");
			expect(lookup?.emailVerified).toBe(true);
		});

		it("should redirect to return URL from state payload", async () => {
			const { app } = createTestApp({ exchangeGoogleCode: stubExchange({ email: "return@example.com" }) });
			const state = signState(freshState({ returnUrl: "/save?url=https%3A%2F%2Fexample.com" }));

			const response = await request(app)
				.get(`/auth/google/callback?code=test-code&state=${encodeURIComponent(state)}`)
				.set("Cookie", `hutch_gstate=${encodeURIComponent(state)}`);

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/save?url=https%3A%2F%2Fexample.com");
		});

		it("should reuse an existing verified email/password account and keep the password working", async () => {
			const { app, auth } = createTestApp({
				exchangeGoogleCode: stubExchange({ email: "existing@example.com" }),
			});
			const createResult = await auth.createUser({ email: "existing@example.com", password: "password123" });
			assert(createResult.ok, "setup failed");
			await auth.markEmailVerified("existing@example.com");
			const existingUserId = createResult.userId;
			const state = signState(freshState());

			const response = await request(app)
				.get(`/auth/google/callback?code=test-code&state=${encodeURIComponent(state)}`)
				.set("Cookie", `hutch_gstate=${encodeURIComponent(state)}`);

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");

			const lookup = await auth.findUserByEmail("existing@example.com");
			expect(lookup?.userId).toBe(existingUserId);
			expect(lookup?.emailVerified).toBe(true);

			const passwordCheck = await auth.verifyCredentials({ email: "existing@example.com", password: "password123" });
			expect(passwordCheck.ok).toBe(true);
		});

		it("should upgrade an unverified email/password account to verified", async () => {
			const { app, auth } = createTestApp({
				exchangeGoogleCode: stubExchange({ email: "unverified@example.com" }),
			});
			await auth.createUser({ email: "unverified@example.com", password: "password123" });
			const beforeLookup = await auth.findUserByEmail("unverified@example.com");
			expect(beforeLookup?.emailVerified).toBe(false);
			const state = signState(freshState());

			const response = await request(app)
				.get(`/auth/google/callback?code=test-code&state=${encodeURIComponent(state)}`)
				.set("Cookie", `hutch_gstate=${encodeURIComponent(state)}`);

			expect(response.status).toBe(303);
			const afterLookup = await auth.findUserByEmail("unverified@example.com");
			expect(afterLookup?.emailVerified).toBe(true);

			const passwordCheck = await auth.verifyCredentials({ email: "unverified@example.com", password: "password123" });
			expect(passwordCheck.ok).toBe(true);
		});
	});
});
