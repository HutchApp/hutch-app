import assert from "node:assert";
import request from "supertest";
import type { Token, Client } from "@node-oauth/oauth2-server";
import { createTestApp, createTestAppWithFetchHtml } from "../../test-app";
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

describe("Queue routes with Siren content negotiation", () => {
	describe("GET /queue (Siren)", () => {
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

		it("returns articles after saving", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			await request(testApp.app)
				.post("/queue")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/article" });

			const response = await request(testApp.app)
				.get("/queue")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`);

			expect(response.status).toBe(200);
			expect(response.body.properties.total).toBe(1);
			expect(response.body.entities).toHaveLength(1);
			expect(response.body.entities[0].rel).toContain("item");
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
	});

	describe("POST /queue (Siren)", () => {
		it("saves article and returns 201", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.post("/queue")
				.set("Accept", SIREN_MEDIA_TYPE)
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
				.post("/queue")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "not-a-url" });

			expect(response.status).toBe(400);
			expect(response.body.properties.code).toBe("invalid-url");
		});

		it("returns 401 without token", async () => {
			const testApp = createTestApp();

			const response = await request(testApp.app)
				.post("/queue")
				.set("Accept", SIREN_MEDIA_TYPE)
				.send({ url: "https://example.com/test" });

			expect(response.status).toBe(401);
		});
	});

	describe("GET /queue/:id (Siren)", () => {
		it("returns article by ID", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const createResponse = await request(testApp.app)
				.post("/queue")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/get-by-id" });

			const articleId = createResponse.body.properties.id;

			const response = await request(testApp.app)
				.get(`/queue/${articleId}`)
				.set("Accept", SIREN_MEDIA_TYPE)
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
				.get("/queue/non-existent-id")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`);

			expect(response.status).toBe(404);
			expect(response.body.properties.code).toBe("not-found");
		});
	});

	describe("GET /queue/:id/read (Siren)", () => {
		it("returns article with content", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const createResponse = await request(testApp.app)
				.post("/queue")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/reader-test" });

			const articleId = createResponse.body.properties.id;

			const response = await request(testApp.app)
				.get(`/queue/${articleId}/read`)
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`);

			expect(response.status).toBe(200);
			expect(response.body.class).toContain("article");
			expect(response.body.properties.content).toBeDefined();
		});

		it("returns 404 for non-existent article", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.get("/queue/non-existent-id/read")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`);

			expect(response.status).toBe(404);
			expect(response.body.properties.code).toBe("not-found");
		});
	});

	describe("PUT /queue/:id/status (Siren)", () => {
		it("returns 400 for invalid status value", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.put("/queue/some-id/status")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ status: "invalid" });

			expect(response.status).toBe(400);
			expect(response.body.properties.code).toBe("invalid-status");
		});

		it("updates article status to read", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const createResponse = await request(testApp.app)
				.post("/queue")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/update-status" });

			const articleId = createResponse.body.properties.id;

			const response = await request(testApp.app)
				.put(`/queue/${articleId}/status`)
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ status: "read" });

			expect(response.status).toBe(200);
			expect(response.body.properties.status).toBe("read");
		});

		it("updates article status to archived", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const createResponse = await request(testApp.app)
				.post("/queue")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/archive" });

			const articleId = createResponse.body.properties.id;

			const response = await request(testApp.app)
				.put(`/queue/${articleId}/status`)
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ status: "archived" });

			expect(response.status).toBe(200);
			expect(response.body.properties.status).toBe("archived");
		});

		it("returns 404 for non-existent article", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.put("/queue/non-existent/status")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ status: "read" });

			expect(response.status).toBe(404);
		});

		it("returns 401 without authorization", async () => {
			const testApp = createTestApp();

			const response = await request(testApp.app)
				.put("/queue/some-id/status")
				.set("Accept", SIREN_MEDIA_TYPE)
				.send({ status: "read" });

			expect(response.status).toBe(401);
		});
	});

	describe("POST /queue/save (Siren content negotiation)", () => {
		it("returns 400 for invalid URL with Siren Accept", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.post("/queue/save")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "not-a-url" });

			expect(response.status).toBe(400);
			expect(response.body.properties.code).toBe("invalid-url");
		});

		it("returns 422 for unparseable URL with Siren Accept", async () => {
			const fetchHtml = async () => undefined;
			const testApp = createTestAppWithFetchHtml(fetchHtml);
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.post("/queue/save")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/unparseable" });

			expect(response.status).toBe(422);
			expect(response.body.properties.code).toBe("invalid-url");
		});

		it("returns 201 with article entity on success", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.post("/queue/save")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/test-article" });

			expect(response.status).toBe(201);
			expect(response.body.class).toContain("article");
			expect(response.body.properties.url).toBe("https://example.com/test-article");
		});
	});

	describe("POST /queue/:id/status (Siren content negotiation)", () => {
		it("returns 400 for invalid status value", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.post("/queue/some-id/status")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ status: "invalid" });

			expect(response.status).toBe(400);
			expect(response.body.properties.code).toBe("invalid-status");
		});

		it("returns 404 for non-existent article", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.post("/queue/non-existent/status")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ status: "read" });

			expect(response.status).toBe(404);
			expect(response.body.properties.code).toBe("not-found");
		});

		it("updates status and returns article entity", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const createResponse = await request(testApp.app)
				.post("/queue")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/status-test" });

			const articleId = createResponse.body.properties.id;

			const response = await request(testApp.app)
				.post(`/queue/${articleId}/status`)
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ status: "read" });

			expect(response.status).toBe(200);
			expect(response.body.properties.status).toBe("read");
		});
	});

	describe("POST /queue/:id/delete (Siren content negotiation)", () => {
		it("returns 404 for non-existent article", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.post("/queue/non-existent/delete")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`);

			expect(response.status).toBe(404);
			expect(response.body.properties.code).toBe("not-found");
		});

		it("deletes article and returns 204", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const createResponse = await request(testApp.app)
				.post("/queue")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/delete-test" });

			const articleId = createResponse.body.properties.id;

			const response = await request(testApp.app)
				.post(`/queue/${articleId}/delete`)
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`);

			expect(response.status).toBe(204);
		});
	});

	describe("DELETE /queue/:id (Siren)", () => {
		it("deletes article and returns 204", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const createResponse = await request(testApp.app)
				.post("/queue")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ url: "https://example.com/to-delete" });

			const articleId = createResponse.body.properties.id;

			const deleteResponse = await request(testApp.app)
				.delete(`/queue/${articleId}`)
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`);

			expect(deleteResponse.status).toBe(204);

			const getResponse = await request(testApp.app)
				.get(`/queue/${articleId}`)
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`);

			expect(getResponse.status).toBe(404);
		});

		it("returns 404 for non-existent article", async () => {
			const testApp = createTestApp();
			const accessToken = await createAccessToken(testApp);

			const response = await request(testApp.app)
				.delete("/queue/non-existent")
				.set("Accept", SIREN_MEDIA_TYPE)
				.set("Authorization", `Bearer ${accessToken}`);

			expect(response.status).toBe(404);
		});

		it("returns 401 without authorization", async () => {
			const testApp = createTestApp();

			const response = await request(testApp.app)
				.delete("/queue/some-id")
				.set("Accept", SIREN_MEDIA_TYPE);

			expect(response.status).toBe(401);
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
});
