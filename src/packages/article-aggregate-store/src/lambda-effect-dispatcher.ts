import {
	CrawlArticleFailedEvent,
	type GenerateSummaryCommand,
	RecrawlCompletedEvent,
	RecrawlLinkInitiatedEvent,
} from "@packages/hutch-infra-components";
import type {
	DispatchCommand,
	PublishEvent,
} from "@packages/hutch-infra-components/runtime";
import type { DispatchEffects, Effect } from "@packages/domain/article";

export interface LambdaEffectDispatcherDeps {
	publishEvent: PublishEvent;
	dispatchGenerateSummary: DispatchCommand<typeof GenerateSummaryCommand>;
}

/**
 * Dispatches each aggregate effect to its existing wire format. Phase-1
 * transitions produce one effect per invocation, so "all-or-nothing per
 * orchestration" reduces to "fire the effect; if it throws, the orchestrator
 * throws and SQS redelivers the input." On redelivery the orchestrator
 * reloads the (now-persisted) aggregate, re-runs the transition (idempotent
 * because the aggregate state already reflects it), and re-emits the same
 * effect — consumers dedupe via the existing at-least-once EventBridge /
 * SQS semantics.
 *
 * Multi-effect transitions (Phase 2+) will land here and rely on the same
 * loop; only when a single transition needs to fan out to >10 destinations
 * does this need to grow into a batched PutEvents implementation. None of
 * Phase 1 or Phase 2's planned transitions cross that threshold.
 */
export function initLambdaEffectDispatcher(
	deps: LambdaEffectDispatcherDeps,
): DispatchEffects {
	return async (effects) => {
		for (const effect of effects) {
			await dispatch(effect, deps);
		}
	};
}

async function dispatch(
	effect: Effect,
	deps: LambdaEffectDispatcherDeps,
): Promise<void> {
	switch (effect.kind) {
		case "DispatchGenerateSummaryCommand":
			await deps.dispatchGenerateSummary({ url: effect.url });
			return;
		case "PublishRecrawlLinkInitiatedEvent":
			await deps.publishEvent({
				source: RecrawlLinkInitiatedEvent.source,
				detailType: RecrawlLinkInitiatedEvent.detailType,
				detail: JSON.stringify({ url: effect.url }),
			});
			return;
		case "PublishCrawlArticleFailedEvent":
			await deps.publishEvent({
				source: CrawlArticleFailedEvent.source,
				detailType: CrawlArticleFailedEvent.detailType,
				detail: JSON.stringify({
					url: effect.url,
					reason: effect.reason,
					receiveCount: effect.receiveCount,
				}),
			});
			return;
		case "PublishRecrawlCompletedEvent":
			await deps.publishEvent({
				source: RecrawlCompletedEvent.source,
				detailType: RecrawlCompletedEvent.detailType,
				detail: JSON.stringify({ url: effect.url }),
			});
			return;
	}
}
