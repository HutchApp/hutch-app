import type { Article } from "../article.types";
import type { Effect } from "../effects.types";
import type { AggregateField } from "../storage.types";

export interface MarkSummaryExhaustedInput {
	reason: string;
	receiveCount: number;
}

/* Summary-only DLQ path: crawl axis is left untouched (unlike markCrawlExhausted
 * which is cross-axis), so a concurrent inline crawl writer is not clobbered. */
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
