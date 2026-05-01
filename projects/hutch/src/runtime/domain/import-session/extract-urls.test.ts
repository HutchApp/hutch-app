import { extractUrls } from "./extract-urls";
import { MAX_URLS_PER_IMPORT } from "./import-session.schema";

describe("extractUrls", () => {
	it("extracts http and https URLs from plain text", () => {
		const buf = Buffer.from(
			"Check out https://example.com/post and http://example.org/article today.",
		);

		const result = extractUrls(buf);

		expect(result.urls).toEqual([
			"https://example.com/post",
			"http://example.org/article",
		]);
		expect(result.truncated).toBe(false);
	});

	it("falls back to latin-1 when utf-8 contains the replacement character", () => {
		// 0xa3 (£) is invalid UTF-8 but a valid Latin-1 byte. The URL itself is ASCII.
		const buf = Buffer.from([
			...Buffer.from("Cost \xa3 https://example.com/article today", "latin1"),
		]);

		const result = extractUrls(buf);

		expect(result.urls).toEqual(["https://example.com/article"]);
	});

	it("extracts URLs from a Pocket-style HTML export", () => {
		const html =
			'<dt><a href="https://example.com/post-1" time_added="123">Post 1</a></dt>' +
			'<dt><a href="https://example.com/post-2" time_added="456">Post 2</a></dt>';

		const result = extractUrls(Buffer.from(html));

		expect(result.urls).toEqual([
			"https://example.com/post-1",
			"https://example.com/post-2",
		]);
	});

	it("extracts URLs nested inside JSON values", () => {
		const json = JSON.stringify({
			items: [
				{ url: "https://example.com/a" },
				{ url: "https://example.com/b" },
			],
		});

		const result = extractUrls(Buffer.from(json));

		expect(result.urls).toEqual(["https://example.com/a", "https://example.com/b"]);
	});

	it("strips trailing punctuation commonly found in prose", () => {
		const text = "see (https://example.com/post), also https://example.org/post.";

		const result = extractUrls(Buffer.from(text));

		expect(result.urls).toEqual([
			"https://example.com/post",
			"https://example.org/post",
		]);
	});

	it("dedupes URLs case-insensitively on host and ignores trailing slash on path-only", () => {
		const text = [
			"https://EXAMPLE.com/",
			"https://example.com",
			"https://example.com/post",
		].join(" ");

		const result = extractUrls(Buffer.from(text));

		expect(result.urls).toEqual(["https://EXAMPLE.com/", "https://example.com/post"]);
	});

	it("caps the result at MAX_URLS_PER_IMPORT and reports truncation", () => {
		const urls = Array.from(
			{ length: MAX_URLS_PER_IMPORT + 5 },
			(_v, i) => `https://example.com/post-${i}`,
		);

		const result = extractUrls(Buffer.from(urls.join("\n")));

		expect(result.urls).toHaveLength(MAX_URLS_PER_IMPORT);
		expect(result.truncated).toBe(true);
	});

	it("returns an empty list when the buffer contains no URLs", () => {
		const result = extractUrls(Buffer.from("No links here. Just prose."));

		expect(result.urls).toEqual([]);
		expect(result.truncated).toBe(false);
	});

	it("rejects non-saveable schemes and bare strings", () => {
		const text = [
			"mailto:foo@bar.com",
			"javascript:alert(1)",
			"chrome://settings",
			"about:blank",
			"data:text/html,<h1>x</h1>",
			"file:///etc/passwd",
			"/relative/path",
			"https://example.com/keep",
		].join("\n");

		const result = extractUrls(Buffer.from(text));

		expect(result.urls).toEqual(["https://example.com/keep"]);
	});
});
