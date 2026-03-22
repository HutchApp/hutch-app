import { initInMemorySummaryCache } from "./in-memory-summary-cache";

describe("initInMemorySummaryCache", () => {
	it("should return empty string for uncached URL", async () => {
		const { findCachedSummary } = initInMemorySummaryCache();

		const result = await findCachedSummary("https://example.com/article");

		expect(result).toBe("");
	});

	it("should return cached summary after saving", async () => {
		const { findCachedSummary, saveCachedSummary } = initInMemorySummaryCache();

		await saveCachedSummary({ url: "https://example.com/article", summary: "A test summary.", inputTokens: 100, outputTokens: 30 });
		const result = await findCachedSummary("https://example.com/article");

		expect(result).toBe("A test summary.");
	});

	it("should not return summary for different URL", async () => {
		const { findCachedSummary, saveCachedSummary } = initInMemorySummaryCache();

		await saveCachedSummary({ url: "https://example.com/one", summary: "Summary one.", inputTokens: 80, outputTokens: 20 });
		const result = await findCachedSummary("https://example.com/two");

		expect(result).toBe("");
	});
});
