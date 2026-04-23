import { createFakeSummaryProvider } from "./test-app-fakes";

describe("createFakeSummaryProvider", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("transitions a pending summary to ready after the delay elapses", async () => {
		const { findGeneratedSummary, markSummaryPending } = createFakeSummaryProvider();
		const url = "https://example.com/article";

		await markSummaryPending({ url });
		expect(await findGeneratedSummary(url)).toEqual({ status: "pending" });

		jest.advanceTimersByTime(500);

		expect(await findGeneratedSummary(url)).toEqual({
			status: "ready",
			summary: `Fake summary for ${url}.`,
		});
	});

	it("leaves an already-ready summary untouched when markSummaryPending is called again", async () => {
		const { findGeneratedSummary, markSummaryPending } = createFakeSummaryProvider();
		const url = "https://example.com/article";

		await markSummaryPending({ url });
		jest.advanceTimersByTime(500);
		await markSummaryPending({ url });

		expect(await findGeneratedSummary(url)).toEqual({
			status: "ready",
			summary: `Fake summary for ${url}.`,
		});
	});
});
