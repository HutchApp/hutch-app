import { initInMemorySummaryCache } from "./in-memory-summary-cache";

describe("initInMemorySummaryCache", () => {
	it("should return null for uncached URL", async () => {
		const { findCachedSummary } = initInMemorySummaryCache();

		const result = await findCachedSummary("https://example.com/article");

		expect(result).toBeNull();
	});

	it("should return cached summary after saving", async () => {
		const { findCachedSummary, saveCachedSummary } = initInMemorySummaryCache();

		await saveCachedSummary({ url: "https://example.com/article", summary: "A test summary." });
		const result = await findCachedSummary("https://example.com/article");

		expect(result).toBe("A test summary.");
	});

	it("should not return summary for different URL", async () => {
		const { findCachedSummary, saveCachedSummary } = initInMemorySummaryCache();

		await saveCachedSummary({ url: "https://example.com/one", summary: "Summary one." });
		const result = await findCachedSummary("https://example.com/two");

		expect(result).toBeNull();
	});
});
