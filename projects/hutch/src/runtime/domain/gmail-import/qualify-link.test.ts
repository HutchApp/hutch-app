import { qualifyLink } from "./qualify-link";

describe("qualifyLink", () => {
	it("accepts a valid https URL", () => {
		const result = qualifyLink("https://example.com/article");

		expect(result).toEqual({ ok: true, url: "https://example.com/article" });
	});

	it("accepts a valid http URL", () => {
		const result = qualifyLink("http://example.com/page");

		expect(result).toEqual({ ok: true, url: "http://example.com/page" });
	});

	it("normalizes the URL via the URL constructor", () => {
		const result = qualifyLink("https://example.com/path?q=1#frag");

		expect(result).toEqual({ ok: true, url: "https://example.com/path?q=1#frag" });
	});

	it("rejects an empty string", () => {
		const result = qualifyLink("");

		expect(result).toEqual({ ok: false, reason: "empty-url" });
	});

	it("rejects a whitespace-only string", () => {
		const result = qualifyLink("   ");

		expect(result).toEqual({ ok: false, reason: "empty-url" });
	});

	it("rejects a malformed URL", () => {
		const result = qualifyLink("not-a-url");

		expect(result).toEqual({ ok: false, reason: "invalid-url" });
	});

	it("rejects a mailto: URL", () => {
		const result = qualifyLink("mailto:user@example.com");

		expect(result).toEqual({ ok: false, reason: "unsupported-protocol" });
	});

	it("rejects a javascript: URL", () => {
		const result = qualifyLink("javascript:alert(1)");

		expect(result).toEqual({ ok: false, reason: "unsupported-protocol" });
	});

	it("rejects a tel: URL", () => {
		const result = qualifyLink("tel:+1234567890");

		expect(result).toEqual({ ok: false, reason: "unsupported-protocol" });
	});

	it("rejects an ftp: URL", () => {
		const result = qualifyLink("ftp://files.example.com/doc");

		expect(result).toEqual({ ok: false, reason: "unsupported-protocol" });
	});
});
