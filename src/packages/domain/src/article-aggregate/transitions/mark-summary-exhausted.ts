import type { Article } from "../article.types";
import type { Effect } from "../effects.types";
import type { AggregateField } from "../storage.types";

export interface MarkSummaryExhaustedInput {
	reason: string;
	receiveCount: number;
}

/* SQS exhausted retries for GenerateSummaryCommand — flip summary to failed
 * and emit SummaryGenerationFailedEvent so the parse-error stream records
 * the terminal state. Crawl axis stays put: a failed summary doesn't
 * invalidate the article body. */
export function markSummaryExhausted(
	article: Article,
	input: MarkSummaryExhaustedInput,
): {
	article: Article;
	effects: readonly Effect[];
	writes: readonly AggregateField[];
} {
	const next: Article = {
		...article,
		summary: { kind: "failed", reason: input.reason },
	};
	const effects: readonly Effect[] = [
		{
			kind: "publish-summary-generation-failed",
			url: article.url,
			reason: input.reason,
			receiveCount: input.receiveCount,
		},
	];
	const writes: readonly AggregateField[] = ["summary"];
	return { article: next, effects, writes };
}
