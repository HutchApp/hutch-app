export type GeneratedSummary =
	| { status: "pending" }
	| { status: "ready"; summary: string; excerpt?: string }
	| { status: "failed"; reason: string }
	| { status: "skipped" };

export type FindGeneratedSummary = (url: string) => Promise<GeneratedSummary | undefined>;

export type MarkSummaryPending = (params: { url: string }) => Promise<void>;
