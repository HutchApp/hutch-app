import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "../../../render";
import {
	CRAWL_STAGE_TO_PCT,
	DEFAULT_CRAWL_STAGE,
	type ProgressTick,
} from "../progress-mapping";

const TEMPLATE = readFileSync(
	join(__dirname, "reader-pending.template.html"),
	"utf-8",
);

export interface ReaderPendingInput {
	pollUrl?: string;
	progress?: ProgressTick;
}

export function renderReaderPending(input: ReaderPendingInput): string {
	const message = input.pollUrl
		? "Fetching article"
		: "Still fetching — refresh to check again.";
	const progress = input.progress ?? {
		stage: DEFAULT_CRAWL_STAGE,
		pct: CRAWL_STAGE_TO_PCT[DEFAULT_CRAWL_STAGE],
		// No tick timestamp available when caller didn't supply one — clients
		// just animate from this static SSR pct on each swap; an empty string
		// tells progress-bar.client.ts to skip the rate-extrapolation pass.
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
