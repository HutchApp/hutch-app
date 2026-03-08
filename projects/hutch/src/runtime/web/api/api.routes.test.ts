import assert from "node:assert";
import request from "supertest";
import type { Token, Client } from "@node-oauth/oauth2-server";
import { createTestApp } from "../../test-app";
import type { UserId } from "../../domain/user/user.types";
import { SIREN_MEDIA_TYPE } from "./siren";

const TEST_USER_ID = "test-user-123" as UserId;

function createTestToken(): Token {
	return {
		accessToken: "test-access-token",
		accessTokenExpiresAt: new Date(Date.now() + 3600000),
		refreshToken: "test-refresh-token",
		refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600000),
		client: {
			id: "hutch-firefox-extension",
			grants: ["authorization_code", "refresh_token"],
			redirectUris: ["http://127.0.0.1:3000/oauth/callback"],
		} as Client,
		user: { id: TEST_USER_ID },
	};
}

async function createAccessToken(
	testApp: ReturnType<typeof createTestApp>,
): Promise<string> {
	const client = await testApp.oauthModel.getClient("hutch-firefox-extension", "");
	assert(client, "Test client must exist");

	const testToken = createTestToken();
	const token = await testApp.oauthModel.saveToken(testToken, client, { id: TEST_USER_ID });
	assert(token, "Token should be saved");
	return token.accessToken;
}

describe("GET /queue (Siren content negotiation)", () => {
	it("returns 401 without token when requesting Siren", async () => {
		const testApp = createTestApp();

		const response = await request(testApp.app)
			.get("/queue")
			.set("Accept", SIREN_MEDIA_TYPE);

		expect(response.status).toBe(401);
		expect(response.body.class).toContain("error");
		expect(response.body.properties.code).toBe("missing-token");
	});

	it("returns empty collection for new user", async () => {
		const testApp = createTestApp();
		const accessToken = await createAccessToken(testApp);

		const response = await request(testApp.app)
			.get("/queue")
			.set("Accept", SIREN_MEDIA_TYPE)
			.set("Authorization", `Bearer ${accessToken}`);

		expect(response.status).toBe(200);
		expect(response.type).toContain("application/vnd.siren+json");
		expect(response.body.class).toContain("collection");
		expect(response.body.class).toContain("articles");
		expect(response.body.properties.total).toBe(0);
		expect(response.body.entities).toEqual([]);
	});

	it("returns articles after saving via HTML form", async () => {
		const testApp = createTestApp();

		await testApp.auth.createUser({ email: "test@example.com", password: "password123" });
		const agent = request.agent(testApp.app);
		await agent
			.post("/login")
			.type("form")
			.send({ email: "test@example.com", password: "password123" });
		await agent
			.post("/queue/save")
			.type("form")
			.send({ url: "https://example.com/article" });

		const loginResult = await testApp.auth.verifyCredentials({ email: "test@example.com", password: "password123" });
		assert(loginResult.ok);
		const userId = loginResult.userId;

		const client = await testApp.oauthModel.getClient("hutch-firefox-extension", "");
		assert(client);
		const userToken = createTestToken();
		userToken.user = { id: userId };
		const token = await testApp.oauthModel.saveToken(userToken, client, { id: userId });
		assert(token);

		const response = await request(testApp.app)
			.get("/queue")
			.set("Accept", SIREN_MEDIA_TYPE)
			.set("Authorization", `Bearer ${token.accessToken}`);

		expect(response.status).toBe(200);
		expect(response.body.properties.total).toBe(1);
		expect(response.body.entities).toHaveLength(1);
		expect(response.body.entities[0].rel).toContain("item");
		expect(response.body.entities[0].properties.url).toBe("https://example.com/article");
	});

	it("returns 401 with invalid token", async () => {
		const testApp = createTestApp();

		const response = await request(testApp.app)
			.get("/queue")
			.set("Accept", SIREN_MEDIA_TYPE)
			.set("Authorization", "Bearer invalid-token");

		expect(response.status).toBe(401);
		expect(response.body.properties.code).toBe("invalid-token");
	});

	it("supports status filter parameter", async () => {
		const testApp = createTestApp();
		const accessToken = await createAccessToken(testApp);

		const response = await request(testApp.app)
			.get("/queue?status=unread")
			.set("Accept", SIREN_MEDIA_TYPE)
			.set("Authorization", `Bearer ${accessToken}`);

		expect(response.status).toBe(200);
		expect(response.body.class).toContain("collection");
	});

	it("supports order parameter", async () => {
		const testApp = createTestApp();
		const accessToken = await createAccessToken(testApp);

		const response = await request(testApp.app)
			.get("/queue?order=asc")
			.set("Accept", SIREN_MEDIA_TYPE)
			.set("Authorization", `Bearer ${accessToken}`);

		expect(response.status).toBe(200);
		expect(response.body.class).toContain("collection");
	});

	it("supports page parameter", async () => {
		const testApp = createTestApp();
		const accessToken = await createAccessToken(testApp);

		const response = await request(testApp.app)
			.get("/queue?page=2")
			.set("Accept", SIREN_MEDIA_TYPE)
			.set("Authorization", `Bearer ${accessToken}`);

		expect(response.status).toBe(200);
		expect(response.body.properties.page).toBe(2);
	});

	it("includes filter-by-status action", async () => {
		const testApp = createTestApp();
		const accessToken = await createAccessToken(testApp);

		const response = await request(testApp.app)
			.get("/queue")
			.set("Accept", SIREN_MEDIA_TYPE)
			.set("Authorization", `Bearer ${accessToken}`);

		const filterAction = response.body.actions?.find(
			(a: { name: string }) => a.name === "filter-by-status",
		);
		expect(filterAction.method).toBe("GET");
		expect(filterAction.fields.map((f: { name: string }) => f.name)).toEqual([
			"status",
			"order",
			"page",
			"pageSize",
		]);
	});

	it("includes save-article action", async () => {
		const testApp = createTestApp();
		const accessToken = await createAccessToken(testApp);

		const response = await request(testApp.app)
			.get("/queue")
			.set("Accept", SIREN_MEDIA_TYPE)
			.set("Authorization", `Bearer ${accessToken}`);

		const saveAction = response.body.actions?.find(
			(a: { name: string }) => a.name === "save-article",
		);
		expect(saveAction.method).toBe("POST");
	});
});

describe("Content negotiation", () => {
	it("returns HTML when Accept header is text/html", async () => {
		const testApp = createTestApp();
		await testApp.auth.createUser({ email: "test@example.com", password: "password123" });
		const agent = request.agent(testApp.app);
		await agent
			.post("/login")
			.type("form")
			.send({ email: "test@example.com", password: "password123" });

		const response = await agent
			.get("/queue")
			.set("Accept", "text/html");

		expect(response.status).toBe(200);
		expect(response.type).toContain("text/html");
	});

	it("returns HTML when Accept header is */*", async () => {
		const testApp = createTestApp();
		await testApp.auth.createUser({ email: "test@example.com", password: "password123" });
		const agent = request.agent(testApp.app);
		await agent
			.post("/login")
			.type("form")
			.send({ email: "test@example.com", password: "password123" });

		const response = await agent
			.get("/queue")
			.set("Accept", "*/*");

		expect(response.status).toBe(200);
		expect(response.type).toContain("text/html");
	});

	it("returns Siren when Accept header is application/vnd.siren+json", async () => {
		const testApp = createTestApp();
		const accessToken = await createAccessToken(testApp);

		const response = await request(testApp.app)
			.get("/queue")
			.set("Accept", SIREN_MEDIA_TYPE)
			.set("Authorization", `Bearer ${accessToken}`);

		expect(response.status).toBe(200);
		expect(response.type).toContain("application/vnd.siren+json");
	});
});
