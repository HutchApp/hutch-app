import type { Article } from "../article.types";
import type { Effect } from "../effects.types";
import type { AggregateField } from "../storage.types";

/* Recrawl tie with canonical kept: no tier flip, no metadata refresh, no
 * summary reset. Generate-summary still fires so the summariser can decide
 * whether to regenerate against the (possibly refreshed) body — on a cache
 * hit it short-circuits without re-running the AI. Crawl flips to ready so
 * the row admin/recrawl marked pending is unstuck. */
export function recrawlTieKeptCanonical(
	article: Article,
	_input: undefined,
): {
	article: Article;
	effects: readonly Effect[];
	writes: readonly AggregateField[];
} {
	const next: Article = {
		...article,
		crawl: { kind: "ready" },
	};
	const effects: readonly Effect[] = [
		{ kind: "generate-summary", url: article.url },
		{ kind: "publish-recrawl-completed", url: article.url },
	];
	const writes: readonly AggregateField[] = ["crawl"];
	return { article: next, effects, writes };
}
