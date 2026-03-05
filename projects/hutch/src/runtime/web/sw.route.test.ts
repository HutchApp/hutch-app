import request from "supertest";
import { createTestApp } from "../test-app";

describe("GET /sw.js", () => {
	it("should serve the service worker file", async () => {
		const { app } = createTestApp();
		const response = await request(app).get("/sw.js");

		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toContain("javascript");
		expect(response.text).toContain("CACHE_NAME");
		expect(response.text).toContain("isArticleRoute");
	});
});
