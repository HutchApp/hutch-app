import type { Article } from "../aggregate.types";
import type { TransitionResult } from "./refresh-content";

// Both substates reset to pending so the reader-slot UI shows the "recrawl
// in progress" skeleton and the summary worker regenerates the AI excerpt
// instead of short-circuiting on the cached "ready" row.
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
