import { initStaticParser } from "./static-parser";

describe("initStaticParser", () => {
	it("should return hostname as siteName", async () => {
		const { parseArticle } = initStaticParser();

		const result = await parseArticle("https://blog.example.com/post/123");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.siteName).toBe("blog.example.com");
		}
	});

	it("should include a title with the hostname", async () => {
		const { parseArticle } = initStaticParser();

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.title).toContain("example.com");
		}
	});

	it("should return error for invalid URL", async () => {
		const { parseArticle } = initStaticParser();

		const result = await parseArticle("not-a-url");

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("Invalid URL");
		}
	});
});
