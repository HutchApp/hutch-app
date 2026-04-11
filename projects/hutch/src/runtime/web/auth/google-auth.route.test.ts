import { createHmac } from "node:crypto";
import { JSDOM } from "jsdom";
import request from "supertest";
import { createTestApp } from "../../test-app";
import { GoogleIdSchema } from "../../providers/google-auth/google-auth.schema";
import type { ExchangeGoogleCode } from "../../providers/google-auth/google-token.types";

const TEST_CLIENT_SECRET = "test-google-client-secret";
const TEST_CLIENT_ID = "test-google-client-id";

function createSignedState(payload: object, secret: string = TEST_CLIENT_SECRET): string {
	const raw = JSON.stringify(payload);
	const mac = createHmac("sha256", secret).update(raw).digest("base64url");
	return `${raw}.${mac}`;
}

function makeStubExchange(overrides?: Partial<Awaited<ReturnType<ExchangeGoogleCode>>>): ExchangeGoogleCode {
	return async () => ({
		googleId: GoogleIdSchema.parse("google-sub-123"),
		email: "google@example.com",
		emailVerified: true,
		...overrides,
	});
}

function createGoogleTestApp(options?: { exchangeGoogleCode?: ExchangeGoogleCode }) {
	return createTestApp({
		exchangeGoogleCode: options?.exchangeGoogleCode ?? makeStubExchange(),
	});
}

describe("Google auth routes", () => {
	describe("GET /auth/google", () => {
		it("should redirect to Google with correct query params and set state cookie", async () => {
			const { app } = createGoogleTestApp();
			const response = await request(app).get("/auth/google");

			expect(response.status).toBe(303);
			const location = new URL(response.headers.location);
			expect(location.origin).toBe("https://accounts.google.com");
			expect(location.pathname).toBe("/o/oauth2/v2/auth");
			expect(location.searchParams.get("client_id")).toBe(TEST_CLIENT_ID);
			expect(location.searchParams.get("response_type")).toBe("code");
			expect(location.searchParams.get("scope")).toBe("openid email");
			expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:3000/auth/google/callback");

			const cookies = response.headers["set-cookie"] as unknown as string[];
			const stateCookie = cookies.find((c) => c.startsWith("hutch_gstate="));
			expect(stateCookie).toBeDefined();
		});

		it("should include return URL in state", async () => {
			const { app } = createGoogleTestApp();
			const response = await request(app).get("/auth/google?return=%2Foauth%2Fauthorize");

			const location = new URL(response.headers.location);
			const state = location.searchParams.get("state");
			expect(state).toBeDefined();
			const dotIndex = state!.lastIndexOf(".");
			const payload = JSON.parse(state!.slice(0, dotIndex));
			expect(payload.returnUrl).toBe("/oauth/authorize");
		});
	});

	describe("GET /auth/google/callback", () => {
		it("should render error when code query param is missing", async () => {
			const { app } = createGoogleTestApp();
			const state = createSignedState({ nonce: "abc", createdAt: Date.now() });

			const response = await request(app)
				.get(`/auth/google/callback?state=${encodeURIComponent(state)}`)
				.set("Cookie", `hutch_gstate=${state}`);

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-global-error]")?.textContent).toContain("Google sign-in failed");
		});

		it("should render error when state cookie is missing", async () => {
			const { app } = createGoogleTestApp();
			const state = createSignedState({ nonce: "abc", createdAt: Date.now() });

			const response = await request(app).get(`/auth/google/callback?code=auth-code&state=${encodeURIComponent(state)}`);

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-global-error]")?.textContent).toContain("Google sign-in failed");
		});

		it("should render error when state param mismatches cookie", async () => {
			const { app } = createGoogleTestApp();
			const agent = request.agent(app);

			await agent.get("/auth/google");

			const differentState = createSignedState({ nonce: "different", createdAt: Date.now() });
			const response = await agent.get(`/auth/google/callback?code=auth-code&state=${encodeURIComponent(differentState)}`);

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-global-error]")?.textContent).toContain("Google sign-in failed");
		});

		it("should create user and session for new Google user with new email", async () => {
			const { app } = createGoogleTestApp();
			const agent = request.agent(app);

			const initResponse = await agent.get("/auth/google");
			const location = new URL(initResponse.headers.location);
			const state = location.searchParams.get("state")!;

			const response = await agent.get(`/auth/google/callback?code=valid-code&state=${encodeURIComponent(state)}`);

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");

			const cookies = response.headers["set-cookie"] as unknown as string[];
			const sessionCookie = cookies.find((c) => c.startsWith("hutch_sid="));
			expect(sessionCookie).toBeDefined();
		});

		it("should render error when Google email matches existing account", async () => {
			const { app, auth } = createGoogleTestApp();
			await auth.createUser({ email: "google@example.com", password: "password123" });

			const agent = request.agent(app);
			const initResponse = await agent.get("/auth/google");
			const location = new URL(initResponse.headers.location);
			const state = location.searchParams.get("state")!;

			const response = await agent.get(`/auth/google/callback?code=valid-code&state=${encodeURIComponent(state)}`);

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-global-error]")?.textContent).toContain("already exists");
		});

		it("should create session for returning Google user (sub already linked)", async () => {
			const { app } = createGoogleTestApp();
			const agent = request.agent(app);

			const initResponse1 = await agent.get("/auth/google");
			const state1 = new URL(initResponse1.headers.location).searchParams.get("state")!;
			await agent.get(`/auth/google/callback?code=valid-code&state=${encodeURIComponent(state1)}`);

			const agent2 = request.agent(app);
			const initResponse2 = await agent2.get("/auth/google");
			const state2 = new URL(initResponse2.headers.location).searchParams.get("state")!;

			const response = await agent2.get(`/auth/google/callback?code=valid-code&state=${encodeURIComponent(state2)}`);

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/queue");
		});

		it("should render error when Google email is not verified", async () => {
			const { app } = createGoogleTestApp({
				exchangeGoogleCode: makeStubExchange({ emailVerified: false }),
			});
			const agent = request.agent(app);

			const initResponse = await agent.get("/auth/google");
			const state = new URL(initResponse.headers.location).searchParams.get("state")!;

			const response = await agent.get(`/auth/google/callback?code=valid-code&state=${encodeURIComponent(state)}`);

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-global-error]")?.textContent).toContain("not verified");
		});

		it("should preserve return URL through the flow", async () => {
			const { app } = createGoogleTestApp();
			const agent = request.agent(app);

			const initResponse = await agent.get("/auth/google?return=%2Foauth%2Fauthorize%3Fclient_id%3Dtest");
			const state = new URL(initResponse.headers.location).searchParams.get("state")!;

			const response = await agent.get(`/auth/google/callback?code=valid-code&state=${encodeURIComponent(state)}`);

			expect(response.status).toBe(303);
			expect(response.headers.location).toBe("/oauth/authorize?client_id=test");
		});

		it("should render error when token exchange throws an Error", async () => {
			const failingExchange: ExchangeGoogleCode = async () => { throw new Error("token exchange failed"); };
			const { app } = createGoogleTestApp({ exchangeGoogleCode: failingExchange });
			const agent = request.agent(app);

			const initResponse = await agent.get("/auth/google");
			const state = new URL(initResponse.headers.location).searchParams.get("state")!;

			const response = await agent.get(`/auth/google/callback?code=bad-code&state=${encodeURIComponent(state)}`);

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-global-error]")?.textContent).toContain("Google sign-in failed");
		});

		it("should render error when token exchange throws a non-Error value", async () => {
			const failingExchange: ExchangeGoogleCode = async () => { throw "token exchange failed"; };
			const { app } = createGoogleTestApp({ exchangeGoogleCode: failingExchange });
			const agent = request.agent(app);

			const initResponse = await agent.get("/auth/google");
			const state = new URL(initResponse.headers.location).searchParams.get("state")!;

			const response = await agent.get(`/auth/google/callback?code=bad-code&state=${encodeURIComponent(state)}`);

			expect(response.status).toBe(400);
		});

		it("should render error when state has invalid signature", async () => {
			const { app } = createGoogleTestApp();
			const payload = JSON.stringify({ nonce: "abc", createdAt: Date.now() });
			const wrongMac = createHmac("sha256", "wrong-secret").update(payload).digest("base64url");
			const tamperedState = `${payload}.${wrongMac}`;

			const response = await request(app)
				.get(`/auth/google/callback?code=valid-code&state=${encodeURIComponent(tamperedState)}`)
				.set("Cookie", `hutch_gstate=${tamperedState}`);

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-global-error]")?.textContent).toContain("Google sign-in failed");
		});

		it("should render error when state has expired", async () => {
			const { app } = createGoogleTestApp();

			const expiredPayload = JSON.stringify({ nonce: "abc", createdAt: Date.now() - 6 * 60 * 1000 });
			const mac = createHmac("sha256", TEST_CLIENT_SECRET).update(expiredPayload).digest("base64url");
			const expiredState = `${expiredPayload}.${mac}`;

			const response = await request(app)
				.get(`/auth/google/callback?code=valid-code&state=${encodeURIComponent(expiredState)}`)
				.set("Cookie", `hutch_gstate=${expiredState}`);

			expect(response.status).toBe(400);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-global-error]")?.textContent).toContain("expired");
		});

		it("should render error when Google email is taken by concurrent signup", async () => {
			const { app, auth } = createGoogleTestApp();
			const agent = request.agent(app);

			const initResponse = await agent.get("/auth/google");
			const state = new URL(initResponse.headers.location).searchParams.get("state")!;

			await auth.createUser({ email: "google@example.com", password: "password123" });

			const response = await agent.get(`/auth/google/callback?code=valid-code&state=${encodeURIComponent(state)}`);

			expect(response.status).toBe(422);
			const doc = new JSDOM(response.text).window.document;
			expect(doc.querySelector("[data-test-global-error]")?.textContent).toContain("already exists");
		});
	});
});
