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

describe("EXCLUDE_PATTERNS — localhost entry", () => {
	const cases: ReadonlyArray<{ url: string; excluded: boolean; label: string }> = [
		{ url: "http://localhost:3000/", excluded: true, label: "http with port" },
		{ url: "http://localhost:3100/privacy?p=7", excluded: true, label: "http with port and query" },
		{ url: "http://localhost/", excluded: true, label: "http no port" },
		{ url: "https://localhost:8080/api", excluded: true, label: "https with port" },
		{ url: "https://notlocalhost.com/foo", excluded: false, label: "domain containing localhost (should NOT match)" },
		{ url: "https://my-localhost.com/foo", excluded: false, label: "hyphenated domain (should NOT match)" },
	];
	for (const { url, excluded, label } of cases) {
		it(`${excluded ? "excludes" : "keeps"}: ${label} — ${url}`, () => {
			assert.equal(isExcluded(url, EXCLUDE_PATTERNS), excluded);
		});
	}
});

describe("EXCLUDE_PATTERNS — about: scheme entry", () => {
	const cases: ReadonlyArray<{ url: string; excluded: boolean; label: string }> = [
		{ url: "about:home", excluded: true, label: "about:home" },
		{ url: "about:newtab", excluded: true, label: "about:newtab" },
		{ url: "about:blank", excluded: true, label: "about:blank" },
		{ url: "https://somesite.com/about:home", excluded: false, label: "about: in path (should NOT match)" },
	];
	for (const { url, excluded, label } of cases) {
		it(`${excluded ? "excludes" : "keeps"}: ${label} — ${url}`, () => {
			assert.equal(isExcluded(url, EXCLUDE_PATTERNS), excluded);
		});
	}
});

describe("EXCLUDE_PATTERNS — chrome:// scheme entry", () => {
	const cases: ReadonlyArray<{ url: string; excluded: boolean; label: string }> = [
		{ url: "chrome://extensions/", excluded: true, label: "chrome://extensions/" },
		{ url: "chrome://newtab/", excluded: true, label: "chrome://newtab/" },
		{ url: "chrome://settings", excluded: true, label: "chrome://settings" },
		{ url: "https://chrome.google.com/webstore", excluded: false, label: "chrome.google.com (should NOT match)" },
	];
	for (const { url, excluded, label } of cases) {
		it(`${excluded ? "excludes" : "keeps"}: ${label} — ${url}`, () => {
			assert.equal(isExcluded(url, EXCLUDE_PATTERNS), excluded);
		});
	}
});

describe("EXCLUDE_PATTERNS — .home.arpa entry", () => {
	const cases: ReadonlyArray<{ url: string; excluded: boolean; label: string }> = [
		{ url: "https://cd.home.arpa/", excluded: true, label: "subdomain of .home.arpa" },
		{ url: "https://router.home.arpa:8080/admin", excluded: true, label: ".home.arpa with port" },
		{ url: "http://home.arpa/", excluded: true, label: "bare .home.arpa" },
		{ url: "https://home.arpa?q=1", excluded: true, label: ".home.arpa with query" },
		{ url: "https://nothome.arpa.com/foo", excluded: false, label: "arpa as subdomain (should NOT match)" },
	];
	for (const { url, excluded, label } of cases) {
		it(`${excluded ? "excludes" : "keeps"}: ${label} — ${url}`, () => {
			assert.equal(isExcluded(url, EXCLUDE_PATTERNS), excluded);
		});
	}
});

describe("EXCLUDE_PATTERNS — example.com entry", () => {
	const cases: ReadonlyArray<{ url: string; excluded: boolean; label: string }> = [
		{ url: "example.com/9598a307-2375-4ecc-a63c-e38f4128c7f5", excluded: true, label: "fixture path without scheme" },
		{ url: "https://example.com/foo", excluded: true, label: "https root path" },
		{ url: "http://example.com", excluded: true, label: "http no path" },
		{ url: "https://www.example.com/foo", excluded: true, label: "www subdomain" },
		{ url: "https://api.test.example.com/bar", excluded: true, label: "nested subdomain" },
		{ url: "https://example.com:8080/foo", excluded: true, label: "explicit port" },
		{ url: "https://example.com?q=1", excluded: true, label: "query immediately after host" },
		{ url: "https://notexample.com/foo", excluded: false, label: "prefixed similar host (should NOT match)" },
		{ url: "https://example.com.evil.com/foo", excluded: false, label: "subdomain trick (should NOT match)" },
		{ url: "https://myexample.com/foo", excluded: false, label: "different domain ending in example.com without dot boundary" },
	];
	for (const { url, excluded, label } of cases) {
		it(`${excluded ? "excludes" : "keeps"}: ${label} — ${url}`, () => {
			assert.equal(isExcluded(url, EXCLUDE_PATTERNS), excluded);
		});
	}
});
