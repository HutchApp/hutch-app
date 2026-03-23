import { normalizeArticleUrl, routeIdFromUrl } from "./normalize-article-url";

describe("normalizeArticleUrl", () => {
	it("strips https scheme", () => {
		expect(normalizeArticleUrl("https://example.com/article")).toBe(
			"example.com/article",
		);
	});

	it("strips http scheme", () => {
		expect(normalizeArticleUrl("http://example.com/article")).toBe(
			"example.com/article",
		);
	});

	it("strips fragment", () => {
		expect(
			normalizeArticleUrl("https://example.com/article#heading"),
		).toBe("example.com/article");
	});

	it("preserves query params", () => {
		expect(
			normalizeArticleUrl("https://example.com/path?q=1&page=2"),
		).toBe("example.com/path?q=1&page=2");
	});

	it("preserves non-default port", () => {
		expect(
			normalizeArticleUrl("https://example.com:8080/path"),
		).toBe("example.com:8080/path");
	});

	it("omits default https port 443", () => {
		expect(
			normalizeArticleUrl("https://example.com:443/path"),
		).toBe("example.com/path");
	});

	it("omits default http port 80", () => {
		expect(
			normalizeArticleUrl("http://example.com:80/path"),
		).toBe("example.com/path");
	});

	it("strips both scheme and fragment together", () => {
		expect(
			normalizeArticleUrl("https://example.com/article?q=1#section"),
		).toBe("example.com/article?q=1");
	});

	it("handles root path", () => {
		expect(normalizeArticleUrl("https://example.com/")).toBe(
			"example.com/",
		);
	});

	it("handles root path without trailing slash", () => {
		expect(normalizeArticleUrl("https://example.com")).toBe(
			"example.com/",
		);
	});
});

describe("routeIdFromUrl", () => {
	it("produces a 32-char hex string", () => {
		const id = routeIdFromUrl("https://example.com/article");
		expect(id).toMatch(/^[0-9a-f]{32}$/);
	});

	it("produces the same ID for the same URL", () => {
		const id1 = routeIdFromUrl("https://example.com/article");
		const id2 = routeIdFromUrl("https://example.com/article");
		expect(id1).toBe(id2);
	});

	it("produces the same ID regardless of scheme", () => {
		const https = routeIdFromUrl("https://example.com/article");
		const http = routeIdFromUrl("http://example.com/article");
		expect(https).toBe(http);
	});

	it("produces the same ID regardless of fragment", () => {
		const withFragment = routeIdFromUrl(
			"https://example.com/article#heading",
		);
		const withoutFragment = routeIdFromUrl(
			"https://example.com/article",
		);
		expect(withFragment).toBe(withoutFragment);
	});

	it("produces different IDs for different URLs", () => {
		const id1 = routeIdFromUrl("https://example.com/article-1");
		const id2 = routeIdFromUrl("https://example.com/article-2");
		expect(id1).not.toBe(id2);
	});

	it("produces different IDs for different query params", () => {
		const id1 = routeIdFromUrl("https://example.com/path?page=1");
		const id2 = routeIdFromUrl("https://example.com/path?page=2");
		expect(id1).not.toBe(id2);
	});
});
