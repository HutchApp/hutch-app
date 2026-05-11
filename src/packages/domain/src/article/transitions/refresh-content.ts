import type { Article } from "../aggregate.types";
import type { Effect } from "../effect.types";
import type { ArticleMetadata, Minutes } from "../article.types";

export interface RefreshContentParams {
	metadata: ArticleMetadata;
	estimatedReadTime: Minutes;
	contentFetchedAt: string;
	etag?: string;
	lastModified?: string;
}

export interface TransitionResult {
	article: Article;
	effects: readonly Effect[];
}

/**
 * Refreshing the persisted content invalidates the cached AI summary, so we
 * MUST reset the summary substate to pending in the same returned article.
 * The discriminated union in `SummaryState` means a future writer cannot move
 * to `status: "ready"` without producing summary text — the kind of dropped
 * pair that left the 2026-05-10 row in `(status=ready, summary=undefined)`
 * polling forever. The accompanying `GenerateSummaryCommand` effect ensures
 * the worker is woken; the orchestrator's "save → dispatch" contract closes
 * the lost-event gap (handler success implies dispatch).
 *
 * The crawl substate is untouched: refresh runs after a successful crawl
 * already, and demoting `ready` back to `pending` would surface a "recrawl
 * in progress" skeleton to readers for no benefit.
 */
export function refreshContent(
	article: Article,
	params: RefreshContentParams,
): TransitionResult {
	const next: Article = {
		...article,
		metadata: params.metadata,
		estimatedReadTime: params.estimatedReadTime,
		contentFetchedAt: params.contentFetchedAt,
		etag: params.etag,
		lastModified: params.lastModified,
		summary: { status: "pending" },
	};

	return {
		article: next,
		effects: [{ kind: "DispatchGenerateSummaryCommand", url: article.url }],
	};
}
