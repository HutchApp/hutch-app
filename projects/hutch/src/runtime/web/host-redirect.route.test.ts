import request from "supertest";
import { createTestApp } from "../test-app";

describe("hutch-app.com legacy host redirect", () => {
	it("redirects a request with Host: hutch-app.com to https://readplace.com", async () => {
		const { app } = createTestApp();

		const response = await request(app).get("/").set("Host", "hutch-app.com");

		expect(response.status).toBe(301);
		expect(response.headers.location).toBe("https://readplace.com/");
	});

	it("preserves path and query string when redirecting", async () => {
		const { app } = createTestApp();

		const response = await request(app)
			.get("/blog/example?utm_source=newsletter")
			.set("Host", "hutch-app.com");

		expect(response.status).toBe(301);
		expect(response.headers.location).toBe(
			"https://readplace.com/blog/example?utm_source=newsletter",
		);
	});

	it("redirects POST requests before authentication middleware runs", async () => {
		const { app } = createTestApp();

		const response = await request(app)
			.post("/queue/delete/some-id")
			.set("Host", "hutch-app.com");

		expect(response.status).toBe(301);
		expect(response.headers.location).toBe(
			"https://readplace.com/queue/delete/some-id",
		);
	});

	it("does not redirect requests with Host: readplace.com", async () => {
		const { app } = createTestApp();

		const response = await request(app).get("/privacy").set("Host", "readplace.com");

		expect(response.status).toBe(200);
	});

	it("does not redirect requests whose host is unrelated", async () => {
		const { app } = createTestApp();

		const response = await request(app).get("/privacy");

		expect(response.status).toBe(200);
	});
});
