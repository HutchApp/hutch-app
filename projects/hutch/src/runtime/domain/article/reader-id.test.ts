import { ReaderId } from "./reader-id";

describe("ReaderId.from", () => {
	it("produces a 32-char hex string", () => {
		const id = ReaderId.from("https://example.com/article");
		expect(id).toMatch(/^[0-9a-f]{32}$/);
	});

	it("produces the same ID for the same URL", () => {
		const id1 = ReaderId.from("https://example.com/article");
		const id2 = ReaderId.from("https://example.com/article");
		expect(id1).toBe(id2);
	});

	it("produces the same ID regardless of scheme", () => {
		const https = ReaderId.from("https://example.com/article");
		const http = ReaderId.from("http://example.com/article");
		expect(https).toBe(http);
	});

	it("produces the same ID regardless of fragment", () => {
		const withFragment = ReaderId.from(
			"https://example.com/article#heading",
		);
		const withoutFragment = ReaderId.from(
			"https://example.com/article",
		);
		expect(withFragment).toBe(withoutFragment);
	});

	it("produces different IDs for different URLs", () => {
		const id1 = ReaderId.from("https://example.com/article-1");
		const id2 = ReaderId.from("https://example.com/article-2");
		expect(id1).not.toBe(id2);
	});

	it("produces different IDs for different query params", () => {
		const id1 = ReaderId.from("https://example.com/path?page=1");
		const id2 = ReaderId.from("https://example.com/path?page=2");
		expect(id1).not.toBe(id2);
	});
});
