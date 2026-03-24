import { resolveRelativeUrls } from "./resolve-relative-urls";

describe("resolveRelativeUrls", () => {
	const baseUrl = "https://example.com/blog/my-article";

	it("should resolve relative img src to absolute URL", () => {
		const html = '<img src="/images/photo.jpg">';
		const result = resolveRelativeUrls({ html, baseUrl });
		expect(result).toContain('src="https://example.com/images/photo.jpg"');
	});

	it("should resolve relative anchor href to absolute URL", () => {
		const html = '<a href="/other-article">Link</a>';
		const result = resolveRelativeUrls({ html, baseUrl });
		expect(result).toContain('href="https://example.com/other-article"');
	});

	it("should leave absolute URLs unchanged", () => {
		const html = '<img src="https://cdn.example.com/photo.jpg">';
		const result = resolveRelativeUrls({ html, baseUrl });
		expect(result).toContain('src="https://cdn.example.com/photo.jpg"');
	});

	it("should resolve path-relative URLs", () => {
		const html = '<img src="photo.jpg">';
		const result = resolveRelativeUrls({ html, baseUrl });
		expect(result).toContain(
			'src="https://example.com/blog/photo.jpg"',
		);
	});

	it("should resolve protocol-relative URLs", () => {
		const html = '<img src="//cdn.example.com/photo.jpg">';
		const result = resolveRelativeUrls({ html, baseUrl });
		expect(result).toContain('src="https://cdn.example.com/photo.jpg"');
	});

	it("should resolve source srcset attributes", () => {
		const html = '<source srcset="/images/photo.webp">';
		const result = resolveRelativeUrls({ html, baseUrl });
		expect(result).toContain(
			'srcset="https://example.com/images/photo.webp"',
		);
	});

	it("should handle multiple elements with relative URLs", () => {
		const html = `
			<img src="/img/one.jpg">
			<a href="/page">Link</a>
			<img src="/img/two.jpg">
		`;
		const result = resolveRelativeUrls({ html, baseUrl });
		expect(result).toContain('src="https://example.com/img/one.jpg"');
		expect(result).toContain('href="https://example.com/page"');
		expect(result).toContain('src="https://example.com/img/two.jpg"');
	});

	it("should not modify anchor links (fragment-only hrefs)", () => {
		const html = '<a href="#section">Jump</a>';
		const result = resolveRelativeUrls({ html, baseUrl });
		expect(result).toContain('href="#section"');
	});

	it("should handle empty content", () => {
		const result = resolveRelativeUrls({ html: "", baseUrl });
		expect(result).toBe("");
	});
});
