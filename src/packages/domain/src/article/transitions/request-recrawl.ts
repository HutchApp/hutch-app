import type { Article } from "../aggregate.types";
import type { TransitionResult } from "./refresh-content";

/**
 * Operator-initiated recrawl resets BOTH substates back to pending so the
 * reader-slot UI shows the "recrawl in progress" skeleton and the summary
 * worker regenerates the AI excerpt instead of short-circuiting on the
 * cached "ready" row (see link-summariser cache-hit at link-summariser.ts:52).
 *
 * This replaces the `forceMarkCrawlPending + forceMarkSummaryPending +
 * publishRecrawlLinkInitiated` triplet at recrawl.page.ts:116-118: in the old
 * shape any of the three could fail independently, leaving the row in an
 * intermediate state (e.g. crawl pending but summary still ready, so the
 * reader shows a skeleton until the next save while the summary worker
 * does nothing). Bundling crawl+summary into one aggregate transition with
 * a single event effect makes "either everything moves or nothing moves"
 * a function-return shape instead of a runtime invariant.
 *
 * Phase 3 will replace the `PublishRecrawlLinkInitiatedEvent` effect with a
 * `DispatchSaveLinkCommand` + setting `contentFetchedAt` to a past value so
 * the standard save path runs. The transition signature is stable across
 * that change; only the effect kinds shift.
 */
export function requestRecrawl(article: Article): TransitionResult {
	const next: Article = {
		...article,
		crawl: { status: "pending" },
		summary: { status: "pending" },
	};

	return {
		article: next,
		effects: [{ kind: "PublishRecrawlLinkInitiatedEvent", url: article.url }],
	};
}
