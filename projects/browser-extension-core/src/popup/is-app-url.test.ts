import { isAppUrl } from "./is-app-url";

describe("isAppUrl", () => {
	it("returns true when tab is on the same origin as serverUrl", () => {
		expect(isAppUrl("https://hutch-app.com/queue", "https://hutch-app.com")).toBe(true);
	});

	it("returns true for localhost dev server", () => {
		expect(isAppUrl("http://127.0.0.1:3000/queue", "http://127.0.0.1:3000")).toBe(true);
	});

	it("returns false for a different domain", () => {
		expect(isAppUrl("https://example.com/article", "https://hutch-app.com")).toBe(false);
	});

	it("returns false for different ports on localhost", () => {
		expect(isAppUrl("http://127.0.0.1:4000/page", "http://127.0.0.1:3000")).toBe(false);
	});

	it("returns false for invalid tab URL", () => {
		expect(isAppUrl("not-a-url", "https://hutch-app.com")).toBe(false);
	});

	it("returns true for nested paths on the server", () => {
		expect(isAppUrl("https://hutch-app.com/read/abc123", "https://hutch-app.com")).toBe(true);
	});
});
