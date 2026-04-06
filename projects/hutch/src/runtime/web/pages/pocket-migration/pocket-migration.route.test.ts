import request from "supertest";
import { createTestApp } from "../../../test-app";

describe("GET /pocket-migration", () => {
	const { app } = createTestApp();

	it("should return 200 and HTML content", async () => {
		const response = await request(app).get("/pocket-migration");
		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toMatch(/text\/html/);
	});
});
