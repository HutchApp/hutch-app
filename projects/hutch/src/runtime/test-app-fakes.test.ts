import { createFakeSummaryProvider } from "./test-app-fakes";

describe("createFakeSummaryProvider", () => {
	it("returns the pending state on every read when readyAfterReads is unset (deterministic for unit tests)", async () => {
		const { findGeneratedSummary, markSummaryPending } = createFakeSummaryProvider();
		const url = "https://example.com/article";

		await markSummaryPending({ url });
		expect(await findGeneratedSummary(url)).toEqual({ status: "pending" });
		expect(await findGeneratedSummary(url)).toEqual({ status: "pending" });
		expect(await findGeneratedSummary(url)).toEqual({ status: "pending" });
	});

	it("transitions a pending summary to ready once readyAfterReads reads have happened", async () => {
		const { findGeneratedSummary, markSummaryPending } = createFakeSummaryProvider({ readyAfterReads: 3 });
		const url = "https://example.com/article";

		await markSummaryPending({ url });
		expect(await findGeneratedSummary(url)).toEqual({ status: "pending" });
		expect(await findGeneratedSummary(url)).toEqual({ status: "pending" });
		expect(await findGeneratedSummary(url)).toEqual({
			status: "ready",
			summary: `Fake summary for ${url}.`,
		});
	});

	it("leaves an already-ready summary untouched when markSummaryPending is called again", async () => {
		const { findGeneratedSummary, markSummaryPending } = createFakeSummaryProvider({ readyAfterReads: 1 });
		const url = "https://example.com/article";

		await markSummaryPending({ url });
		await findGeneratedSummary(url);
		await markSummaryPending({ url });

		expect(await findGeneratedSummary(url)).toEqual({
			status: "ready",
			summary: `Fake summary for ${url}.`,
		});
	});

	it("returns undefined for a URL that has never been marked pending", async () => {
		const { findGeneratedSummary } = createFakeSummaryProvider({ readyAfterReads: 1 });

		expect(await findGeneratedSummary("https://example.com/never-saved")).toBeUndefined();
	});
});
