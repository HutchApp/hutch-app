import request from "supertest";
import type { Client, Token } from "@node-oauth/oauth2-server";
import { createTestApp } from "../../test-app";
import type { UserId } from "../../domain/user/user.types";

const TEST_USER_ID = "test-user-123" as UserId;

async function createAccessToken(
	testApp: ReturnType<typeof createTestApp>,
): Promise<string> {
	const client = (await testApp.oauthModel.getClient(
		"hutch-firefox-extension",
		"",
	)) as Client;
	const token = (await testApp.oauthModel.saveToken(
		{
			accessToken: "test-access-token",
			accessTokenExpiresAt: new Date(Date.now() + 3600000),
			refreshToken: "test-refresh-token",
			refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600000),
		} as Token,
		client,
		{ id: TEST_USER_ID },
	)) as Token;
	return token.accessToken;
}

describe("API routes", () => {
	describe("GET /api", () => {
		it("returns Siren root entity with links", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.get("/api")
				.set("Authorization", `Bearer ${accessToken}`);

			expect(response.status).toBe(200);
			expect(response.type).toContain("application/vnd.siren+json");
			expect(response.body.class).toContain("root");
			expect(response.body.links).toContainEqual(
				expect.objectContaining({ rel: ["self"], href: "/api" }),
			);
			expect(response.body.links).toContainEqual(
				expect.objectContaining({ rel: ["articles"], href: "/api/articles" }),
			);
		});
	});

	describe("GET /api/me", () => {
		it("returns 401 without token", async () => {
			const testApp = createTestApp();

			const response = await request(testApp.app).get("/api/me");

			expect(response.status).toBe(401);
			expect(response.body.class).toContain("error");
			expect(response.body.properties.code).toBe("missing-token");
		});

		it("returns current user with valid token", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.get("/api/me")
				.set("Authorization", `Bearer ${accessToken}`);

			expect(response.status).toBe(200);
			expect(response.body.class).toContain("user");
			expect(response.body.properties.userId).toBe(TEST_USER_ID);
		});

		it("returns 401 with invalid token", async () => {
			const testApp = createTestApp();

			const response = await request(testApp.app)
				.get("/api/me")
				.set("Authorization", "Bearer invalid-token");

			expect(response.status).toBe(401);
			expect(response.body.properties.code).toBe("invalid-token");
		});
	});

	describe("GET /api/articles", () => {
		it("returns empty collection for new user", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.get("/api/articles")
				.set("Authorization", `Bearer ${accessToken}`);

			expect(response.status).toBe(200);
			expect(response.body.class).toContain("collection");
			expect(response.body.class).toContain("articles");
			expect(response.body.properties.total).toBe(0);
			expect(response.body.entities).toEqual([]);
		});

		it("returns articles after saving", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			await request(testApp.app)
				.post("/api/articles")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/article" });

			const response = await request(testApp.app)
				.get("/api/articles")
				.set("Authorization", `Bearer ${accessToken}`);

			expect(response.status).toBe(200);
			expect(response.body.properties.total).toBe(1);
			expect(response.body.entities).toHaveLength(1);
			expect(response.body.entities[0].rel).toContain("item");
		});

		it("returns 400 for invalid query params", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.get("/api/articles?status=invalid")
				.set("Authorization", `Bearer ${accessToken}`);

			expect(response.status).toBe(400);
			expect(response.body.properties.code).toBe("invalid-query");
		});
	});

	describe("POST /api/articles", () => {
		it("saves article and returns 201", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.post("/api/articles")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/test-article" });

			expect(response.status).toBe(201);
			expect(response.body.class).toContain("article");
			expect(response.body.properties.url).toBe(
				"https://example.com/test-article",
			);
			expect(response.body.properties.status).toBe("unread");
		});

		it("returns 400 for invalid URL", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.post("/api/articles")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "not-a-url" });

			expect(response.status).toBe(400);
			expect(response.body.properties.code).toBe("invalid-url");
		});

		it("returns 401 without token", async () => {
			const testApp = createTestApp();

			const response = await request(testApp.app)
				.post("/api/articles")
				.send({ url: "https://example.com/test" });

			expect(response.status).toBe(401);
		});
	});

	describe("GET /api/articles/:id", () => {
		it("returns article by ID", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const createResponse = await request(testApp.app)
				.post("/api/articles")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/get-by-id" });

			const articleId = createResponse.body.properties.id;

			const response = await request(testApp.app)
				.get(`/api/articles/${articleId}`)
				.set("Authorization", `Bearer ${accessToken}`);

			expect(response.status).toBe(200);
			expect(response.body.class).toContain("article");
			expect(response.body.properties.id).toBe(articleId);
			expect(response.body.properties.content).toBeDefined();
		});

		it("returns 404 for non-existent article", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.get("/api/articles/non-existent-id")
				.set("Authorization", `Bearer ${accessToken}`);

			expect(response.status).toBe(404);
			expect(response.body.properties.code).toBe("not-found");
		});
	});

	describe("PUT /api/articles/:id/status", () => {
		it("updates article status to read", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const createResponse = await request(testApp.app)
				.post("/api/articles")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/update-status" });

			const articleId = createResponse.body.properties.id;

			const response = await request(testApp.app)
				.put(`/api/articles/${articleId}/status`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ status: "read" });

			expect(response.status).toBe(200);
			expect(response.body.properties.status).toBe("read");
		});

		it("updates article status to archived", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const createResponse = await request(testApp.app)
				.post("/api/articles")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/archive" });

			const articleId = createResponse.body.properties.id;

			const response = await request(testApp.app)
				.put(`/api/articles/${articleId}/status`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ status: "archived" });

			expect(response.status).toBe(200);
			expect(response.body.properties.status).toBe("archived");
		});

		it("returns 400 for invalid status", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const createResponse = await request(testApp.app)
				.post("/api/articles")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/invalid-status" });

			const articleId = createResponse.body.properties.id;

			const response = await request(testApp.app)
				.put(`/api/articles/${articleId}/status`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ status: "invalid" });

			expect(response.status).toBe(400);
			expect(response.body.properties.code).toBe("invalid-status");
		});

		it("returns 404 for non-existent article", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.put("/api/articles/non-existent/status")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ status: "read" });

			expect(response.status).toBe(404);
		});

		it("returns 401 without authorization", async () => {
			const testApp = createTestApp();

			const response = await request(testApp.app)
				.put("/api/articles/some-id/status")
				.send({ status: "read" });

			expect(response.status).toBe(401);
		});
	});

	describe("DELETE /api/articles/:id", () => {
		it("deletes article and returns 204", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const createResponse = await request(testApp.app)
				.post("/api/articles")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/to-delete" });

			const articleId = createResponse.body.properties.id;

			const deleteResponse = await request(testApp.app)
				.delete(`/api/articles/${articleId}`)
				.set("Authorization", `Bearer ${accessToken}`);

			expect(deleteResponse.status).toBe(204);

			const getResponse = await request(testApp.app)
				.get(`/api/articles/${articleId}`)
				.set("Authorization", `Bearer ${accessToken}`);

			expect(getResponse.status).toBe(404);
		});

		it("returns 404 for non-existent article", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.delete("/api/articles/non-existent")
				.set("Authorization", `Bearer ${accessToken}`);

			expect(response.status).toBe(404);
		});

		it("returns 401 without authorization", async () => {
			const testApp = createTestApp();

			const response = await request(testApp.app).delete(
				"/api/articles/some-id",
			);

			expect(response.status).toBe(401);
		});
	});
});
