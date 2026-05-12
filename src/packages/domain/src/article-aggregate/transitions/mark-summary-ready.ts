import type { Article } from "../article.types";
import type { Effect } from "../effects.types";
import type { AggregateField } from "../storage.types";

export interface MarkSummaryReadyInput {
	summary: string;
	excerpt: string;
	inputTokens: number;
	outputTokens: number;
}

/* Summariser succeeded — persist the generated text together with token
 * counts and emit SummaryGeneratedEvent so observers (logger, future
 * recommenders) see a single fact. Save → dispatch order matters: the row
 * flips ready before the event fires so a fast subscriber re-reading the row
 * doesn't catch it still pending. */
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
			inputTokens: input.inputTokens,
			outputTokens: input.outputTokens,
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
