import type { Article } from "../article.types";
import type { Effect } from "../effects.types";
import type { AggregateField } from "../storage.types";

export interface MarkCrawlFailedInput {
	reason: string;
}

/* Pending → failed for in-flight crawl errors (parse failures, fetch errors
 * that the worker chooses to surface immediately). No event published — the
 * DLQ handler emits CrawlArticleFailedEvent via markCrawlExhausted once SQS
 * gives up. Writes only the crawl axis so a concurrent metadata/freshness
 * write from the same handler is not clobbered. */
export function markCrawlFailed(
	article: Article,
	input: MarkCrawlFailedInput,
): {
	article: Article;
	effects: readonly Effect[];
	writes: readonly AggregateField[];
} {
	const next: Article = {
		...article,
		crawl: { kind: "failed", reason: input.reason },
	};
	const writes: readonly AggregateField[] = ["crawl"];
	return { article: next, effects: [], writes };
}
