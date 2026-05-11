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

// Refreshing content invalidates the cached AI summary, so we reset the
// summary substate to pending.
//
// The crawl substate is untouched: demoting `ready` back to `pending` would
// surface a "recrawl in progress" skeleton to readers for no benefit.
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
