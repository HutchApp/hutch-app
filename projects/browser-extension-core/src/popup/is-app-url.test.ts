import { isAppUrl } from "./is-app-url";

describe("isAppUrl", () => {
	it("returns true when tab is on the same origin as serverUrl", () => {
		expect(isAppUrl({ tabUrl: "https://readplace.com/queue", serverUrl: "https://readplace.com" })).toBe(true);
	});

	it("returns true for localhost dev server", () => {
		expect(isAppUrl({ tabUrl: "http://127.0.0.1:3000/queue", serverUrl: "http://127.0.0.1:3000" })).toBe(true);
	});

	it("returns false for a different domain", () => {
		expect(isAppUrl({ tabUrl: "https://example.com/article", serverUrl: "https://readplace.com" })).toBe(false);
	});

	it("returns false for different ports on localhost", () => {
		expect(isAppUrl({ tabUrl: "http://127.0.0.1:4000/page", serverUrl: "http://127.0.0.1:3000" })).toBe(false);
	});

	it("returns false for invalid tab URL", () => {
		expect(isAppUrl({ tabUrl: "not-a-url", serverUrl: "https://readplace.com" })).toBe(false);
	});

	it("returns true for nested paths on the server", () => {
		expect(isAppUrl({ tabUrl: "https://readplace.com/read/abc123", serverUrl: "https://readplace.com" })).toBe(true);
	});
});
