import type { Article } from "../aggregate.types";
import type { TransitionResult } from "./refresh-content";

/**
 * Operator recrawl finished but the Deepseek selector returned a tie AND
 * the row's canonical was already set. The handler keeps the existing
 * canonical content as-is (no S3 promote, no metadata replace) but MUST
 * flip the row back out of the `pending` state the upstream
 * `requestRecrawl` wrote — otherwise readers and the canary poll a row
 * whose canonical S3 content is intact but whose state machine says
 * "recrawl in progress" forever (commit 538b19ee was the original fix
 * for this exact stuck-row pathology). Bundling the crawl flip with both
 * the generate-summary command and the recrawl-completed fact closes the
 * regression at compile time: a future writer cannot move the row back
 * to ready without also waking the summary worker and signalling
 * completion.
 */
export function recrawlTieKeptCanonical(article: Article): TransitionResult {
	const next: Article = {
		...article,
		crawl: { status: "ready" },
	};
	return {
		article: next,
		effects: [
			{ kind: "DispatchGenerateSummaryCommand", url: article.url },
			{ kind: "PublishRecrawlCompletedEvent", url: article.url },
		],
	};
}
