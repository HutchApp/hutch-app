import type { Article } from "../article.types";
import type { Effect } from "../effects.types";
import type { AggregateField } from "../storage.types";

export interface MarkCrawlUnsupportedInput {
	reason: string;
}

/* Terminal transition: the origin returned a non-html content type (PDF, image,
 * archive, …). Pair the crawl flip with summary=skipped so the canary doesn't
 * keep flagging the row as pending; no retry, no event. */
export function markCrawlUnsupported(
	article: Article,
	input: MarkCrawlUnsupportedInput,
): {
	article: Article;
	effects: readonly Effect[];
	writes: readonly AggregateField[];
} {
	const next: Article = {
		...article,
		crawl: { kind: "unsupported", reason: input.reason },
		summary: { kind: "skipped", reason: "crawl-unsupported" },
	};
	const writes: readonly AggregateField[] = ["crawl", "summary"];
	return { article: next, effects: [], writes };
}
