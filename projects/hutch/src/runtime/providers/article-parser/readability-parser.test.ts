import { initReadabilityParser } from "./readability-parser";

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
		const fetchHtml = async (_url: string) => ARTICLE_HTML;
		const { parseArticle } = initReadabilityParser({ fetchHtml });

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.title).toBe("Test Article Title");
		}
	});

	it("should extract article content as HTML", async () => {
		const fetchHtml = async (_url: string) => ARTICLE_HTML;
		const { parseArticle } = initReadabilityParser({ fetchHtml });

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.content).toContain("first paragraph");
		}
	});

	it("should calculate word count from extracted text", async () => {
		const fetchHtml = async (_url: string) => ARTICLE_HTML;
		const { parseArticle } = initReadabilityParser({ fetchHtml });

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.wordCount).toBeGreaterThan(0);
		}
	});

	it("should extract thumbnail from og:image", async () => {
		const fetchHtml = async (_url: string) => ARTICLE_HTML;
		const { parseArticle } = initReadabilityParser({ fetchHtml });

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.imageUrl).toBe("https://example.com/image.jpg");
		}
	});

	it("should return error for invalid URL", async () => {
		const fetchHtml = async (_url: string) => ARTICLE_HTML;
		const { parseArticle } = initReadabilityParser({ fetchHtml });

		const result = await parseArticle("not-a-url");

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("Invalid URL");
		}
	});

	it("should return error when fetch fails", async () => {
		const fetchHtml = async (_url: string) => undefined;
		const { parseArticle } = initReadabilityParser({ fetchHtml });

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("Could not fetch article");
		}
	});

	it("should fall back to hostname when readability cannot parse", async () => {
		const fetchHtml = async (_url: string) => "<html><body></body></html>";
		const { parseArticle } = initReadabilityParser({ fetchHtml });

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
		const fetchHtml = async (_url: string) => htmlWithoutSiteName;
		const { parseArticle } = initReadabilityParser({ fetchHtml });

		const result = await parseArticle("https://blog.example.com/post");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.siteName).toBe("blog.example.com");
		}
	});

	it("should strip script tags from content for XSS protection", async () => {
		const htmlWithScript = `
		<html><head><title>Article</title></head>
		<body><article>
			<h1>Article</h1>
			<p>Safe content here with enough text for readability parsing.</p>
			<script>alert('xss')</script>
			<p>More safe content for the article body text.</p>
		</article></body></html>`;
		const fetchHtml = async (_url: string) => htmlWithScript;
		const { parseArticle } = initReadabilityParser({ fetchHtml });

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.content).not.toContain("<script>");
			expect(result.article.content).not.toContain("alert('xss')");
		}
	});

	it("should strip event handlers from elements for XSS protection", async () => {
		const htmlWithEventHandler = `
		<html><head><title>Article</title></head>
		<body><article>
			<h1>Article</h1>
			<p>Content before image with enough text for parsing.</p>
			<img src="x" onerror="alert('xss')">
			<p>Content after image with more text for the parser.</p>
		</article></body></html>`;
		const fetchHtml = async (_url: string) => htmlWithEventHandler;
		const { parseArticle } = initReadabilityParser({ fetchHtml });

		const result = await parseArticle("https://example.com/article");

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.article.content).not.toContain("onerror");
			expect(result.article.content).not.toContain("alert('xss')");
		}
	});
});
