import type { Article } from "../aggregate.types";
import type { TransitionResult } from "./refresh-content";

export interface MarkCrawlExhaustedParams {
	reason: string;
	failedAt: string;
	receiveCount: number;
}

/**
 * Terminal transition for SQS DLQ handlers: when a crawl-side command has
 * exceeded its `maxReceiveCount` the row's crawl AND summary states both
 * settle to `failed` together, with the corresponding wire-event published
 * for canary classification. Bundling both substate updates and the event
 * into one transition closes the four-instance regression class where the
 * three legacy calls (`markCrawlFailed`, `markSummaryFailed`,
 * `publishEvent`) could partially succeed and leave the row in a
 * half-failed shape.
 *
 * If the crawl already settled to a non-pending state (e.g. a sibling
 * tier-0 capture flipped `crawl=ready` while the DLQ message was in
 * flight) the transition is a no-op and emits no effect, mirroring the
 * existing `swallowConditionalCheckFailure` pattern in the per-state
 * writer at dynamodb-article-crawl.ts:65. The aggregate's discriminated
 * crawl union makes this guard a single `if` instead of two parallel
 * `ConditionExpression` clauses spread across two writers.
 */
export function markCrawlExhausted(
	article: Article,
	params: MarkCrawlExhaustedParams,
): TransitionResult {
	if (
		article.crawl.status === "ready" ||
		article.crawl.status === "unsupported"
	) {
		return { article, effects: [] };
	}
	const next: Article = {
		...article,
		crawl: {
			status: "failed",
			reason: params.reason,
			failedAt: params.failedAt,
		},
		summary: { status: "failed", reason: "crawl failed" },
	};
	return {
		article: next,
		effects: [
			{
				kind: "PublishCrawlArticleFailedEvent",
				url: article.url,
				reason: params.reason,
				receiveCount: params.receiveCount,
			},
		],
	};
}
