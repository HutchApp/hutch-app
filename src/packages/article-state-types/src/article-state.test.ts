import { CrawlStatusSchema, SummaryStatusSchema } from "./article-state";

describe("SummaryStatusSchema", () => {
	it.each(["pending", "ready", "failed", "skipped"])("accepts %s", (value) => {
		expect(SummaryStatusSchema.parse(value)).toBe(value);
	});

	it("rejects unknown values", () => {
		expect(SummaryStatusSchema.safeParse("unknown").success).toBe(false);
	});
});

describe("CrawlStatusSchema", () => {
	it.each(["pending", "ready", "failed"])("accepts %s", (value) => {
		expect(CrawlStatusSchema.parse(value)).toBe(value);
	});

	it("rejects unknown values, including summary-only states", () => {
		expect(CrawlStatusSchema.safeParse("skipped").success).toBe(false);
		expect(CrawlStatusSchema.safeParse("absent").success).toBe(false);
	});
});
