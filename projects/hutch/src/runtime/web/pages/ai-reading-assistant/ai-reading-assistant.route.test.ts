import request from "supertest";
import { createTestApp } from "../../../test-app";

describe("GET /ai-reading-assistant", () => {
	const { app } = createTestApp();

	it("should return 200 and HTML content", async () => {
		const response = await request(app).get("/ai-reading-assistant");
		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toMatch(/text\/html/);
	});
});
