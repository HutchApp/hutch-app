import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "../../../render";
import {
	DEFAULT_SUMMARY_STAGE,
	type ProgressTick,
	SUMMARY_STAGE_TO_PCT,
} from "../progress-mapping";

const TEMPLATE = readFileSync(
	join(__dirname, "summary-pending.template.html"),
	"utf-8",
);

export interface SummaryPendingInput {
	pollUrl?: string;
	progress?: ProgressTick;
}

export function renderSummaryPending(input: SummaryPendingInput): string {
	const message = input.pollUrl
		? "Generating summary"
		: "Still generating — refresh to check again.";
	const progress = input.progress ?? {
		stage: DEFAULT_SUMMARY_STAGE,
		pct: SUMMARY_STAGE_TO_PCT[DEFAULT_SUMMARY_STAGE],
		tickAt: "",
	};
	return render(TEMPLATE, {
		pollUrl: input.pollUrl,
		message,
		progressStage: progress.stage,
		progressPct: progress.pct,
		progressTickAt: progress.tickAt,
	});
}
