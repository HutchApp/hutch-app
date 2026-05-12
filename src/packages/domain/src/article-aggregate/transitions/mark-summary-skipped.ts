import type { Article } from "../article.types";
import type { Effect } from "../effects.types";
import type { AggregateField } from "../storage.types";

export interface MarkSummarySkippedInput {
	reason: string;
}

/* Pending → skipped when the summariser decides the body is unsuitable
 * ("content-too-short", "ai-unavailable", …). No event. */
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
	const writes: readonly AggregateField[] = ["summary"];
	return { article: next, effects: [], writes };
}
