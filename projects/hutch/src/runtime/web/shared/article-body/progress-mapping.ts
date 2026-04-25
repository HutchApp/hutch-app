export const CRAWL_STAGE_TO_PCT = {
	"crawl-fetching": 15,
	"crawl-fetched": 35,
	"crawl-parsed": 55,
	"crawl-metadata-written": 70,
	"crawl-content-uploaded": 90,
	"crawl-ready": 100,
} as const;

export type CrawlStage = keyof typeof CRAWL_STAGE_TO_PCT;

export const CRAWL_STAGES = Object.keys(CRAWL_STAGE_TO_PCT) as readonly CrawlStage[];

export const SUMMARY_STAGE_TO_PCT = {
	"summary-started": 10,
	"summary-content-loaded": 25,
	"summary-generating": 40,
	"summary-complete": 100,
} as const;

export type SummaryStage = keyof typeof SUMMARY_STAGE_TO_PCT;

export const SUMMARY_STAGES = Object.keys(SUMMARY_STAGE_TO_PCT) as readonly SummaryStage[];

/** Default stage for a freshly-pending crawl that hasn't yet recorded a stage. */
export const DEFAULT_CRAWL_STAGE: CrawlStage = "crawl-fetching";

/** Default stage for a freshly-pending summary that hasn't yet recorded a stage. */
export const DEFAULT_SUMMARY_STAGE: SummaryStage = "summary-started";

export interface ProgressTick {
	stage: string;
	pct: number;
	tickAt: string;
}

export function crawlStagePct(stage: CrawlStage): number {
	return CRAWL_STAGE_TO_PCT[stage];
}

export function summaryStagePct(stage: SummaryStage): number {
	return SUMMARY_STAGE_TO_PCT[stage];
}
