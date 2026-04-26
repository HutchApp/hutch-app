import type { SummaryStage } from "../../web/shared/article-body/progress-mapping";

export type GeneratedSummary =
	| { status: "pending"; stage?: SummaryStage }
	| { status: "ready"; summary: string }
	| { status: "failed"; reason: string }
	| { status: "skipped" };

export type FindGeneratedSummary = (url: string) => Promise<GeneratedSummary | undefined>;

export type MarkSummaryPending = (params: { url: string }) => Promise<void>;
