import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SNIPPET_A, SNIPPET_B, SNIPPET_C, byteLength, substituteOrigins } from "./snippets";

const SNIPPETS_DIR = join(__dirname, "snippets");
const MAX_BYTES = 1024;
const FILES = ["snippet-a.html", "snippet-b.html", "snippet-c.html"] as const;

describe("snippet byte sizes", () => {
	it.each(FILES)("%s must be at most 1024 raw bytes", (name) => {
		const bytes = readFileSync(join(SNIPPETS_DIR, name)).byteLength;
		expect(bytes).toBeLessThanOrEqual(MAX_BYTES);
	});

	it.each(FILES)("%s must not be empty", (name) => {
		const bytes = readFileSync(join(SNIPPETS_DIR, name)).byteLength;
		expect(bytes).toBeGreaterThan(0);
	});
});

describe("snippet content invariants", () => {
	const all = [
		["A", SNIPPET_A],
		["B", SNIPPET_B],
		["C", SNIPPET_C],
	] as const;

	it.each(all)("snippet %s references the canonical readplace.com save endpoint", (_label, snippet) => {
		expect(snippet).toContain("https://readplace.com/save");
	});

	it.each(all)("snippet %s references the canonical embed origin icon URL", (_label, snippet) => {
		expect(snippet).toContain("https://embed.readplace.com/icon.svg");
	});

	it.each(all)("snippet %s contains no <script> tags", (_label, snippet) => {
		expect(snippet).not.toMatch(/<script/i);
	});

	it.each(all)("snippet %s contains no cookie assignments or JavaScript event handlers", (_label, snippet) => {
		expect(snippet).not.toMatch(/document\.cookie|onclick=|onload=/i);
	});

	it.each(all)("snippet %s must not contain rel=\"nofollow\" — publishers endorse us and should pass link equity", (_label, snippet) => {
		expect(snippet).not.toMatch(/rel=["']nofollow/i);
	});
});

describe("byteLength", () => {
	it("should count bytes in a short ASCII string as character count", () => {
		expect(byteLength("hello")).toBe(5);
	});

	it("should count bytes correctly for multibyte UTF-8 characters", () => {
		expect(byteLength("—")).toBe(3);
	});
});

describe("substituteOrigins", () => {
	it("should replace the canonical Readplace app origin with the supplied appOrigin", () => {
		const input = `<a href="https://readplace.com/save">Save</a>`;
		const result = substituteOrigins(input, {
			appOrigin: "http://127.0.0.1:3000",
			embedOrigin: "https://embed.readplace.com",
		});
		expect(result).toBe(`<a href="http://127.0.0.1:3000/save">Save</a>`);
	});

	it("should replace the canonical embed origin with the supplied embedOrigin", () => {
		const input = `<img src="https://embed.readplace.com/icon.svg">`;
		const result = substituteOrigins(input, {
			appOrigin: "https://readplace.com",
			embedOrigin: "http://localhost:3700",
		});
		expect(result).toBe(`<img src="http://localhost:3700/icon.svg">`);
	});

	it("should replace both origins at once", () => {
		const input = `<a href="https://readplace.com/save"><img src="https://embed.readplace.com/icon.svg"></a>`;
		const result = substituteOrigins(input, {
			appOrigin: "http://127.0.0.1:3000",
			embedOrigin: "http://localhost:3700",
		});
		expect(result).toBe(
			`<a href="http://127.0.0.1:3000/save"><img src="http://localhost:3700/icon.svg"></a>`,
		);
	});

	it("should return the input unchanged when both origins equal their canonical values", () => {
		const input = `<a href="https://readplace.com/save"><img src="https://embed.readplace.com/icon.svg"></a>`;
		const result = substituteOrigins(input, {
			appOrigin: "https://readplace.com",
			embedOrigin: "https://embed.readplace.com",
		});
		expect(result).toBe(input);
	});

	it("should not replace 'https://readplace.com' when it appears as a substring of 'https://embed.readplace.com'", () => {
		const input = `<a href="https://embed.readplace.com/icon.svg">`;
		const result = substituteOrigins(input, {
			appOrigin: "http://app.local",
			embedOrigin: "http://embed.local",
		});
		expect(result).toBe(`<a href="http://embed.local/icon.svg">`);
	});
});
