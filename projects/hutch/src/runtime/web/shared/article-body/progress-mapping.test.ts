import {
	CRAWL_STAGES,
	CRAWL_STAGE_TO_PCT,
	DEFAULT_CRAWL_STAGE,
	DEFAULT_SUMMARY_STAGE,
	SUMMARY_STAGES,
	SUMMARY_STAGE_TO_PCT,
	crawlStagePct,
	summaryStagePct,
} from "./progress-mapping";

describe("progress-mapping", () => {
	describe("CRAWL_STAGE_TO_PCT", () => {
		const cases: Array<[keyof typeof CRAWL_STAGE_TO_PCT, number]> = [
			["crawl-fetching", 15],
			["crawl-fetched", 35],
			["crawl-parsed", 55],
			["crawl-metadata-written", 70],
			["crawl-content-uploaded", 90],
			["crawl-ready", 100],
		];
		it.each(cases)("maps %s to %d", (stage, pct) => {
			expect(crawlStagePct(stage)).toBe(pct);
		});

		it("is monotonically increasing across the declared stage order", () => {
			const pcts = CRAWL_STAGES.map((s) => CRAWL_STAGE_TO_PCT[s]);
			for (let i = 1; i < pcts.length; i += 1) {
				expect(pcts[i]).toBeGreaterThan(pcts[i - 1]);
			}
		});

		it("terminates at 100", () => {
			expect(CRAWL_STAGE_TO_PCT["crawl-ready"]).toBe(100);
		});
	});

	describe("SUMMARY_STAGE_TO_PCT", () => {
		const cases: Array<[keyof typeof SUMMARY_STAGE_TO_PCT, number]> = [
			["summary-started", 10],
			["summary-content-loaded", 25],
			["summary-generating", 40],
			["summary-complete", 100],
		];
		it.each(cases)("maps %s to %d", (stage, pct) => {
			expect(summaryStagePct(stage)).toBe(pct);
		});

		it("is monotonically increasing across the declared stage order", () => {
			const pcts = SUMMARY_STAGES.map((s) => SUMMARY_STAGE_TO_PCT[s]);
			for (let i = 1; i < pcts.length; i += 1) {
				expect(pcts[i]).toBeGreaterThan(pcts[i - 1]);
			}
		});

		it("terminates at 100", () => {
			expect(SUMMARY_STAGE_TO_PCT["summary-complete"]).toBe(100);
		});
	});

	describe("default stages", () => {
		it("DEFAULT_CRAWL_STAGE is the first declared crawl stage", () => {
			expect(DEFAULT_CRAWL_STAGE).toBe(CRAWL_STAGES[0]);
		});
		it("DEFAULT_SUMMARY_STAGE is the first declared summary stage", () => {
			expect(DEFAULT_SUMMARY_STAGE).toBe(SUMMARY_STAGES[0]);
		});
	});
});
