import { stripHtml } from "./strip-html";

describe("stripHtml", () => {
	it("should remove HTML tags", () => {
		expect(stripHtml("<p>Hello</p>")).toBe("Hello");
	});

	it("should collapse whitespace", () => {
		expect(stripHtml("<p>Hello</p>   <p>World</p>")).toBe("Hello World");
	});

	it("should decode common HTML entities", () => {
		expect(stripHtml("&amp; &lt; &gt; &quot; &nbsp; &#160;")).toBe('& < > "');
	});

	it("should handle real article content with nested markup", () => {
		const html = '<DIV class="page"><div><p>First paragraph.</p><blockquote><em>A quote</em></blockquote></div></DIV>';
		expect(stripHtml(html)).toBe("First paragraph. A quote");
	});
});
