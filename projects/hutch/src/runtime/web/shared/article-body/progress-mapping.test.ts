import {
	CRAWL_STAGES,
	CRAWL_STAGE_TO_PCT,
	SUMMARY_STAGES,
	SUMMARY_STAGE_TO_PCT,
	crawlStagePct,
	summaryStagePct,
} from "./progress-mapping";

describe("progress-mapping", () => {
	it("orders crawl stages monotonically", () => {
		const pcts = CRAWL_STAGES.map((s) => CRAWL_STAGE_TO_PCT[s]);
		const sorted = [...pcts].sort((a, b) => a - b);
		expect(pcts).toEqual(sorted);
	});

	it("orders summary stages monotonically", () => {
		const pcts = SUMMARY_STAGES.map((s) => SUMMARY_STAGE_TO_PCT[s]);
		const sorted = [...pcts].sort((a, b) => a - b);
		expect(pcts).toEqual(sorted);
	});

	it("places summary stages strictly after the highest crawl stage so the bar never regresses when crawl flips ready", () => {
		const lastCrawl = Math.max(
			...CRAWL_STAGES.map((s) => CRAWL_STAGE_TO_PCT[s]),
		);
		const firstSummary = Math.min(
			...SUMMARY_STAGES.map((s) => SUMMARY_STAGE_TO_PCT[s]),
		);
		expect(firstSummary).toBeGreaterThan(lastCrawl);
	});

	it("ends the unified scale at exactly 100% on summary-complete", () => {
		expect(summaryStagePct("summary-complete")).toBe(100);
	});

	it("starts the unified scale above 0 so the bar is visible immediately on crawl-fetching", () => {
		expect(crawlStagePct("crawl-fetching")).toBeGreaterThan(0);
	});
});
