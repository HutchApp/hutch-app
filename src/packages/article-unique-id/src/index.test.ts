import { ArticleUniqueId } from "./index";

describe("ArticleUniqueId.parse", () => {
	it("strips https scheme", () => {
		expect(ArticleUniqueId.parse("https://example.com/article").value).toBe("example.com/article");
	});

	it("strips http scheme", () => {
		expect(ArticleUniqueId.parse("http://example.com/article").value).toBe("example.com/article");
	});

	it("strips fragment", () => {
		expect(ArticleUniqueId.parse("https://example.com/article#heading").value).toBe("example.com/article");
	});

	it("preserves query params", () => {
		expect(ArticleUniqueId.parse("https://example.com/path?q=1&page=2").value).toBe("example.com/path?q=1&page=2");
	});

	it("preserves non-default port", () => {
		expect(ArticleUniqueId.parse("https://example.com:8080/path").value).toBe("example.com:8080/path");
	});

	it("omits default https port 443", () => {
		expect(ArticleUniqueId.parse("https://example.com:443/path").value).toBe("example.com/path");
	});

	it("omits default http port 80", () => {
		expect(ArticleUniqueId.parse("http://example.com:80/path").value).toBe("example.com/path");
	});

	it("handles root path", () => {
		expect(ArticleUniqueId.parse("https://example.com/").value).toBe("example.com/");
	});

	it("handles root path without trailing slash", () => {
		expect(ArticleUniqueId.parse("https://example.com").value).toBe("example.com/");
	});

	it("produces same ID regardless of scheme", () => {
		expect(ArticleUniqueId.parse("https://example.com/article").value).toBe(ArticleUniqueId.parse("http://example.com/article").value);
	});
});
