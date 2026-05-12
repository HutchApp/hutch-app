import type { Article, ArticleMetadata } from "../article.types";
import type { Effect } from "../effects.types";
import type { AggregateField } from "../storage.types";

export interface PromoteTierInput {
	tier: "tier-0" | "tier-1";
	metadata: ArticleMetadata;
	estimatedReadTime: number;
	contentFetchedAt: string;
	/** True when the canonical tier flipped this run; gates publish-link-saved
	 *  / publish-anonymous-link-saved so a re-pick of the same tier does not
	 *  re-fire user-facing notifications. */
	canonicalChanged: boolean;
	/** Authenticated save: emits publish-link-saved. Absent: emits
	 *  publish-anonymous-link-saved. */
	userId?: string;
}

/* The selector chose a winning tier and the canonical S3 object has been
 * copied in by the handler. Flip crawl=ready (and clear any prior failure
 * reasons via the storage adapter's REMOVE), refresh metadata, reset summary
 * so the generate-summary worker re-runs against the new canonical body, and
 * publish the chain of facts that downstream observers expect.
 *
 * The handler MUST do the S3 CopyObject before calling this transition: the
 * aggregate save races with anything observing crawl=ready, so the body must
 * be on disk first. */
export function promoteTier(
	article: Article,
	input: PromoteTierInput,
): {
	article: Article;
	effects: readonly Effect[];
	writes: readonly AggregateField[];
} {
	const next: Article = {
		...article,
		metadata: input.metadata,
		freshness: {
			...article.freshness,
			contentFetchedAt: input.contentFetchedAt,
		},
		estimatedReadTime: input.estimatedReadTime,
		crawl: { kind: "ready" },
		summary: { kind: "pending" },
	};
	const effects: Effect[] = [
		{ kind: "generate-summary", url: article.url },
		{ kind: "publish-crawl-article-completed", url: article.url },
	];
	if (input.canonicalChanged) {
		effects.push(
			input.userId
				? { kind: "publish-link-saved", url: article.url, userId: input.userId }
				: { kind: "publish-anonymous-link-saved", url: article.url },
		);
	}
	const writes: readonly AggregateField[] = [
		"metadata",
		"freshness",
		"crawl",
		"summary",
	];
	return { article: next, effects, writes };
}
