import { ArticleResourceUniqueId } from "./index";

describe("ArticleResourceUniqueId.parse", () => {
	it("strips https scheme", () => {
		expect(ArticleResourceUniqueId.parse("https://example.com/article").value).toBe("example.com/article");
	});

	it("strips http scheme", () => {
		expect(ArticleResourceUniqueId.parse("http://example.com/article").value).toBe("example.com/article");
	});

	it("strips fragment", () => {
		expect(ArticleResourceUniqueId.parse("https://example.com/article#heading").value).toBe("example.com/article");
	});

	it("preserves query params", () => {
		expect(ArticleResourceUniqueId.parse("https://example.com/path?q=1&page=2").value).toBe("example.com/path?q=1&page=2");
	});

	it("preserves non-default port", () => {
		expect(ArticleResourceUniqueId.parse("https://example.com:8080/path").value).toBe("example.com:8080/path");
	});

	it("omits default https port 443", () => {
		expect(ArticleResourceUniqueId.parse("https://example.com:443/path").value).toBe("example.com/path");
	});

	it("omits default http port 80", () => {
		expect(ArticleResourceUniqueId.parse("http://example.com:80/path").value).toBe("example.com/path");
	});

	it("handles root path", () => {
		expect(ArticleResourceUniqueId.parse("https://example.com/").value).toBe("example.com/");
	});

	it("handles root path without trailing slash", () => {
		expect(ArticleResourceUniqueId.parse("https://example.com").value).toBe("example.com/");
	});

	it("produces same ID regardless of scheme", () => {
		expect(ArticleResourceUniqueId.parse("https://example.com/article").value).toBe(ArticleResourceUniqueId.parse("http://example.com/article").value);
	});
});

describe("ArticleResourceUniqueId.toEncodedURLPathComponent", () => {
	it("encodes slashes in path", () => {
		expect(ArticleResourceUniqueId.parse("https://example.com/blog/post").toEncodedURLPathComponent())
			.toBe("example.com%2Fblog%2Fpost");
	});

	it("encodes trailing slash", () => {
		expect(ArticleResourceUniqueId.parse("https://example.com/article/").toEncodedURLPathComponent())
			.toBe("example.com%2Farticle%2F");
	});

	it("encodes query string characters", () => {
		expect(ArticleResourceUniqueId.parse("https://example.com/path?q=1&page=2").toEncodedURLPathComponent())
			.toBe("example.com%2Fpath%3Fq%3D1%26page%3D2");
	});

	it("encodes colon in port", () => {
		expect(ArticleResourceUniqueId.parse("https://example.com:8080/path").toEncodedURLPathComponent())
			.toBe("example.com%3A8080%2Fpath");
	});

	it("encodes percent-encoded spaces in path", () => {
		expect(ArticleResourceUniqueId.parse("https://example.com/my%20article").toEncodedURLPathComponent())
			.toBe("example.com%2Fmy%2520article");
	});

	it("encodes hash-like characters that survived normalization", () => {
		expect(ArticleResourceUniqueId.parse("https://example.com/path#heading").toEncodedURLPathComponent())
			.toBe("example.com%2Fpath");
	});

	it("round-trips through decodeURIComponent", () => {
		const encoded = ArticleResourceUniqueId.parse("https://example.com/blog/post/").toEncodedURLPathComponent();
		expect(decodeURIComponent(encoded)).toBe("example.com/blog/post/");
	});

	it("encodes substack-style nested paths", () => {
		const encoded = ArticleResourceUniqueId.parse("https://daviddfriedman.substack.com/p/consequences-of-climate-change").toEncodedURLPathComponent();
		expect(encoded).toBe("daviddfriedman.substack.com%2Fp%2Fconsequences-of-climate-change");
		expect(decodeURIComponent(encoded)).toBe("daviddfriedman.substack.com/p/consequences-of-climate-change");
	});

	it("encodes unicode characters in path", () => {
		const encoded = ArticleResourceUniqueId.parse("https://example.com/café").toEncodedURLPathComponent();
		expect(decodeURIComponent(encoded)).toBe("example.com/caf%C3%A9");
	});

	it("encodes plus signs in path", () => {
		const encoded = ArticleResourceUniqueId.parse("https://example.com/c++guide").toEncodedURLPathComponent();
		expect(encoded).toContain("%2B%2B");
		expect(decodeURIComponent(encoded)).toBe("example.com/c++guide");
	});
});

describe("ArticleResourceUniqueId.toJSON / toString", () => {
	it("toJSON returns the normalized value", () => {
		expect(ArticleResourceUniqueId.parse("https://example.com/path").toJSON()).toBe("example.com/path");
	});

	it("toString returns the normalized value", () => {
		expect(ArticleResourceUniqueId.parse("https://example.com/path").toString()).toBe("example.com/path");
	});

	it("serializes as a plain string via JSON.stringify", () => {
		expect(JSON.stringify(ArticleResourceUniqueId.parse("https://example.com/path"))).toBe('"example.com/path"');
	});

	it("interpolates as the normalized value in template literals", () => {
		expect(`${ArticleResourceUniqueId.parse("https://example.com/path")}`).toBe("example.com/path");
	});
});
