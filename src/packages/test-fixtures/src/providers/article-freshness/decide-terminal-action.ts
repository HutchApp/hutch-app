import type { ArticleCrawl } from "../article-crawl/article-crawl.types";

/**
 * The stale-check has three possible decisions when a row exists. Encoded as
 * a typed action so a new ArticleCrawl variant breaks the build here — the
 * single owner of "should the stale-check reprime this row?". Operator-only
 * recovery (via /admin/recrawl) is encoded as "skip" on terminal states.
 */
type TerminalAction = "refresh-eligible" | "skip";

export function decideTerminalAction(
	crawl: ArticleCrawl | undefined,
): TerminalAction {
	/** Legacy row with no crawl status — the TTL gate decides (no
	 * contentFetchedAt means "treat as new"; refresh-eligible drops it back
	 * onto the caller's existing branches). */
	if (!crawl) return "refresh-eligible";

	switch (crawl.status) {
		case "ready":
		case "pending":
			return "refresh-eligible";
		case "failed":
		case "unsupported":
			return "skip";
	}
}
