import { initInMemorySourceContent } from "./in-memory-source-content";

describe("initInMemorySourceContent", () => {
	it("stores html under the URL+tier source key and reads it back", async () => {
		const { putSourceContent, readSourceContent } = initInMemorySourceContent();

		await putSourceContent({ url: "https://example.com/article", tier: "tier-0", html: "<p>captured</p>" });

		expect(readSourceContent({ url: "https://example.com/article", tier: "tier-0" })).toBe("<p>captured</p>");
	});

	it("treats different schemes of the same canonical URL as the same key", async () => {
		const { putSourceContent, readSourceContent } = initInMemorySourceContent();

		await putSourceContent({ url: "https://example.com/article", tier: "tier-0", html: "<p>captured</p>" });

		expect(readSourceContent({ url: "http://example.com/article", tier: "tier-0" })).toBe("<p>captured</p>");
	});

	it("partitions storage by tier so two tiers for the same URL coexist", async () => {
		const { putSourceContent, readSourceContent } = initInMemorySourceContent();

		await putSourceContent({ url: "https://example.com/article", tier: "tier-0", html: "<p>tier 0</p>" });
		await putSourceContent({ url: "https://example.com/article", tier: "tier-1", html: "<p>tier 1</p>" });

		expect(readSourceContent({ url: "https://example.com/article", tier: "tier-0" })).toBe("<p>tier 0</p>");
		expect(readSourceContent({ url: "https://example.com/article", tier: "tier-1" })).toBe("<p>tier 1</p>");
	});

	it("returns undefined when no html has been stored for the URL+tier", () => {
		const { readSourceContent } = initInMemorySourceContent();
		expect(readSourceContent({ url: "https://example.com/never-saved", tier: "tier-0" })).toBeUndefined();
	});
});
