import { initStaticParser } from "./static-parser";

const noopFetchHtml = async (_url: string) => undefined;

describe("initStaticParser", () => {
	it("should return hostname as siteName", async () => {
		const { parseArticle } = initStaticParser({ fetchHtml: noopFetchHtml });

		const result = await parseArticle("https://blog.example.com/post/123");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.siteName).toBe("blog.example.com");
		}
	});

	it("should include a title with the hostname", async () => {
		const { parseArticle } = initStaticParser({ fetchHtml: noopFetchHtml });

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.title).toContain("example.com");
		}
	});

	it("should return error for invalid URL", async () => {
		const { parseArticle } = initStaticParser({ fetchHtml: noopFetchHtml });

		const result = await parseArticle("not-a-url");

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("Invalid URL");
		}
	});

	it("should extract imageUrl from fetched HTML when fetchHtml is provided", async () => {
		const fetchHtml = async (_url: string) =>
			`<html><head><meta property="og:image" content="https://example.com/og.jpg"></head></html>`;

		const { parseArticle } = initStaticParser({ fetchHtml });
		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.imageUrl).toBe("https://example.com/og.jpg");
		}
	});

	it("should leave imageUrl undefined when fetchHtml returns undefined", async () => {
		const { parseArticle } = initStaticParser({ fetchHtml: noopFetchHtml });
		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.imageUrl).toBeUndefined();
		}
	});
});
