import assert from "node:assert";
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
	dispatchGenerateSummary?: DispatchCommand<typeof GenerateSummaryCommand>;
}

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
			assert(
				deps.dispatchGenerateSummary,
				"DispatchGenerateSummaryCommand effect requires dispatchGenerateSummary dep",
			);
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
