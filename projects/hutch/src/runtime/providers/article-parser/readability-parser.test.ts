import { initReadabilityParser, parseHtml } from "./readability-parser";

const ARTICLE_HTML = `
<html>
<head>
  <title>Test Article Title</title>
  <meta property="og:site_name" content="Test Blog">
  <meta property="og:image" content="https://example.com/image.jpg">
</head>
<body>
  <article>
    <h1>Test Article Title</h1>
    <p>This is the first paragraph of the article with enough text to be meaningful content for readability extraction.</p>
    <p>This is the second paragraph with additional content that helps readability determine this is a real article worth parsing.</p>
    <p>And a third paragraph to ensure there is enough content for the word count calculation to work properly.</p>
  </article>
</body>
</html>`;

describe("initReadabilityParser", () => {
	it("should extract article title from HTML", async () => {
		const crawlArticle = async () => ({ status: "fetched" as const, html: ARTICLE_HTML });
		const { parseArticle } = initReadabilityParser({ crawlArticle });

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.title).toBe("Test Article Title");
		}
	});

	it("should extract article content as HTML", async () => {
		const crawlArticle = async () => ({ status: "fetched" as const, html: ARTICLE_HTML });
		const { parseArticle } = initReadabilityParser({ crawlArticle });

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.content).toContain("first paragraph");
		}
	});

	it("should calculate word count from extracted text", async () => {
		const crawlArticle = async () => ({ status: "fetched" as const, html: ARTICLE_HTML });
		const { parseArticle } = initReadabilityParser({ crawlArticle });

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.wordCount).toBeGreaterThan(0);
		}
	});

	it("should pass through thumbnailUrl from the crawl result as imageUrl", async () => {
		const crawlArticle = async () => ({
			status: "fetched" as const,
			html: ARTICLE_HTML,
			thumbnailUrl: "https://example.com/image.jpg",
		});
		const { parseArticle } = initReadabilityParser({ crawlArticle });

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.imageUrl).toBe("https://example.com/image.jpg");
		}
	});

	it("should return error for invalid URL", async () => {
		const crawlArticle = async () => ({ status: "fetched" as const, html: ARTICLE_HTML });
		const { parseArticle } = initReadabilityParser({ crawlArticle });

		const result = await parseArticle("not-a-url");

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("Invalid URL");
		}
	});

	it("should return error when crawl fails", async () => {
		const crawlArticle = async () => ({ status: "failed" as const });
		const { parseArticle } = initReadabilityParser({ crawlArticle });

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("Could not fetch article");
		}
	});

	it("should return error when crawl returns not-modified (unexpected on first fetch)", async () => {
		const crawlArticle = async () => ({ status: "not-modified" as const });
		const { parseArticle } = initReadabilityParser({ crawlArticle });

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("Could not fetch article");
		}
	});

	it("should fall back to hostname when readability cannot parse", async () => {
		const crawlArticle = async () => ({ status: "fetched" as const, html: "<html><body></body></html>" });
		const { parseArticle } = initReadabilityParser({ crawlArticle });

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.title).toContain("example.com");
			expect(result.article.siteName).toBe("example.com");
		}
	});

	it("should use hostname as siteName when og:site_name is absent", async () => {
		const htmlWithoutSiteName = `
		<html><head><title>Post</title></head>
		<body><article>
			<h1>Post</h1>
			<p>Enough content to be parsed by readability as a real article with several words in this paragraph.</p>
			<p>Another paragraph for good measure with additional text.</p>
		</article></body></html>`;
		const crawlArticle = async () => ({ status: "fetched" as const, html: htmlWithoutSiteName });
		const { parseArticle } = initReadabilityParser({ crawlArticle });

		const result = await parseArticle("https://blog.example.com/post");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.siteName).toBe("blog.example.com");
		}
	});

	it("should use hostname as title when parsed title is empty string", async () => {
		const htmlWithEmptyTitle = `
		<html><head><title></title></head>
		<body><article>
			<p>Enough content to be parsed by readability as a real article with several words in this paragraph.</p>
			<p>Another paragraph for good measure with additional text to satisfy the parser minimum.</p>
		</article></body></html>`;
		const crawlArticle = async () => ({ status: "fetched" as const, html: htmlWithEmptyTitle });
		const { parseArticle } = initReadabilityParser({ crawlArticle });

		const result = await parseArticle("https://blog.example.com/post");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.title).toContain("blog.example.com");
		}
	});

	it("should return content string from parsed article", async () => {
		const crawlArticle = async () => ({ status: "fetched" as const, html: ARTICLE_HTML });
		const { parseArticle } = initReadabilityParser({ crawlArticle });

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(typeof result.article.content).toBe("string");
		}
	});

	it("should resolve relative image URLs to absolute", () => {
		const htmlWithRelativeImg = `
		<html><head><title>Post</title></head>
		<body><article>
			<h1>Post</h1>
			<p>Enough content to be parsed by readability as a real article with several words.</p>
			<img src="/images/diagram.jpg" alt="Diagram">
			<p>Another paragraph with additional text for the parser.</p>
		</article></body></html>`;

		const result = parseHtml({
			url: "https://blog.example.com/post",
			html: htmlWithRelativeImg,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.content).toContain(
				'src="https://blog.example.com/images/diagram.jpg"',
			);
			expect(result.article.content).not.toContain('src="/images/diagram.jpg"');
		}
	});

	it("should resolve relative link hrefs to absolute", () => {
		const htmlWithRelativeLink = `
		<html><head><title>Post</title></head>
		<body><article>
			<h1>Post</h1>
			<p>Enough content to be parsed by readability as a real article with several words.</p>
			<p>See <a href="/other-post">this other post</a> for more details.</p>
			<p>Another paragraph with additional text for the parser.</p>
		</article></body></html>`;

		const result = parseHtml({
			url: "https://blog.example.com/post",
			html: htmlWithRelativeLink,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.content).toContain(
				'href="https://blog.example.com/other-post"',
			);
		}
	});

	it("should return error for invalid URL passed to parseHtml directly", () => {
		const result = parseHtml({ url: "not-a-url", html: "<html><body></body></html>" });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("Invalid URL");
		}
	});

	it("should return ok:false when Readability throws (bodyless HTML5 with content inside <nav>)", () => {
		const paragraph =
			"<p>Content paragraph with enough text to be a real article worth reading for the readability parser to consider it. </p>";
		const html = `<!DOCTYPE html><html lang=en><title>T</title><nav><h1>Head</h1>${paragraph.repeat(8)}</nav>`;

		const result = parseHtml({ url: "https://example.com/page", html });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toMatch(/^Readability parse failed:/);
		}
	});

	it("should use fallback values when readability returns empty fields", () => {
		const minimalHtml = `<html><head></head><body>${"<p>word </p>".repeat(100)}</body></html>`;
		const result = parseHtml({ url: "https://example.com/page", html: minimalHtml });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.siteName).toBe("example.com");
			expect(typeof result.article.excerpt).toBe("string");
		}
	});
});
