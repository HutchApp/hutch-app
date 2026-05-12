import type { SummarySkipReason } from "@packages/article-state-types";
import type { Article } from "../article.types";
import type { Effect } from "../effects.types";
import type { AggregateField } from "../storage.types";

export interface MarkSummarySkippedInput {
	reason: SummarySkipReason;
}

/* `writes` scoped to summary only so a concurrent inline crawl writer is not clobbered. */
export function markSummarySkipped(
	article: Article,
	input: MarkSummarySkippedInput,
): {
	article: Article;
	effects: readonly Effect[];
	writes: readonly AggregateField[];
} {
	const next: Article = {
		...article,
		summary: { kind: "skipped", reason: input.reason },
	};
	const effects: readonly Effect[] = [];
	const writes: readonly AggregateField[] = ["summary"];
	return { article: next, effects, writes };
}
