import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXCLUDE_PATTERNS, isExcluded } from "./exclude-patterns";

describe("isExcluded", () => {
	it("returns false when no patterns are configured", () => {
		assert.equal(isExcluded("https://example.test/a", []), false);
	});

	it("returns true when any configured pattern matches the URL", () => {
		const patterns = [/:\/\/internal\.test/];
		assert.equal(isExcluded("https://internal.test/a", patterns), true);
		assert.equal(isExcluded("https://other.test/a", patterns), false);
	});

	it("returns true when at least one of multiple patterns matches", () => {
		const patterns = [/:\/\/foo\.test/, /:\/\/bar\.test/];
		assert.equal(isExcluded("https://bar.test/a", patterns), true);
	});
});

describe("EXCLUDE_PATTERNS", () => {
	it("excludes example.com URLs with https scheme", () => {
		assert.equal(isExcluded("https://example.com/some-path", EXCLUDE_PATTERNS), true);
	});

	it("excludes example.com URLs with http scheme", () => {
		assert.equal(isExcluded("http://example.com/some-path", EXCLUDE_PATTERNS), true);
	});

	it("excludes bare example.com without scheme", () => {
		assert.equal(isExcluded("example.com/some-path", EXCLUDE_PATTERNS), true);
	});

	it("excludes example.com root without trailing path", () => {
		assert.equal(isExcluded("https://example.com", EXCLUDE_PATTERNS), true);
	});

	it("does not exclude subdomains of example.com", () => {
		assert.equal(isExcluded("https://sub.example.com/a", EXCLUDE_PATTERNS), false);
	});

	it("does not exclude domains containing example.com as a substring", () => {
		assert.equal(isExcluded("https://notexample.com/a", EXCLUDE_PATTERNS), false);
	});

	it("does not exclude real article URLs", () => {
		assert.equal(isExcluded("https://hackernoon.com/article", EXCLUDE_PATTERNS), false);
	});
});
