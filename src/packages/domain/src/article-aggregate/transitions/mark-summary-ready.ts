import type { Article } from "../article.types";
import type { Effect } from "../effects.types";
import type { AggregateField } from "../storage.types";

export interface MarkSummaryReadyInput {
	summary: string;
	excerpt: string;
	inputTokens: number;
	outputTokens: number;
}

/* `writes` scoped to summary only so a concurrent inline crawl writer is not clobbered. */
export function markSummaryReady(
	article: Article,
	input: MarkSummaryReadyInput,
): {
	article: Article;
	effects: readonly Effect[];
	writes: readonly AggregateField[];
} {
	const next: Article = {
		...article,
		summary: {
			kind: "ready",
			summary: input.summary,
			excerpt: input.excerpt,
		},
	};
	const effects: readonly Effect[] = [
		{
			kind: "publish-summary-generated",
			url: article.url,
			inputTokens: input.inputTokens,
			outputTokens: input.outputTokens,
		},
	];
	const writes: readonly AggregateField[] = ["summary"];
	return { article: next, effects, writes };
}
