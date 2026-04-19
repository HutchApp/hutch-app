import type { GeneratedSummary } from "../../../../providers/article-summary/article-summary.types";
import { renderSummaryFailed } from "./summary-failed.component";
import { renderSummaryPending } from "./summary-pending.component";
import { renderSummaryReady } from "./summary-ready.component";
import { renderSummarySkipped } from "./summary-skipped.component";

export interface SummarySlotInput {
	summary: GeneratedSummary | undefined;
	summaryPollUrl?: string;
	summaryOpen?: boolean;
}

export function renderSummarySlot(input: SummarySlotInput): string {
	const summary = input.summary ?? { status: "pending" };
	switch (summary.status) {
		case "ready":
			return renderSummaryReady({
				summary: summary.summary,
				open: input.summaryOpen === true,
			});
		case "pending":
			return renderSummaryPending({ pollUrl: input.summaryPollUrl });
		case "failed":
			return renderSummaryFailed();
		case "skipped":
			return renderSummarySkipped();
	}
}
