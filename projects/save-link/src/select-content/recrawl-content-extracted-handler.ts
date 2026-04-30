import assert from "node:assert";
import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import type { DispatchCommand, PublishEvent } from "@packages/hutch-infra-components/runtime";
import {
	type GenerateSummaryCommand,
	RecrawlContentExtractedEvent,
	RecrawlCompletedEvent,
} from "@packages/hutch-infra-components";
import type { ListAvailableTierSources } from "./list-available-tier-sources";
import type { SelectMostCompleteContent } from "./select-content";
import type { PromoteTierToCanonical } from "./promote-tier-to-canonical";
import type { TierSource } from "./tier-source.types";

export function initRecrawlContentExtractedHandler(deps: {
	listAvailableTierSources: ListAvailableTierSources;
	selectMostCompleteContent: SelectMostCompleteContent;
	promoteTierToCanonical: PromoteTierToCanonical;
	dispatchGenerateSummary: DispatchCommand<typeof GenerateSummaryCommand>;
	publishEvent: PublishEvent;
	logger: HutchLogger;
}): SQSHandler {
	const {
		listAvailableTierSources,
		selectMostCompleteContent,
		promoteTierToCanonical,
		dispatchGenerateSummary,
		publishEvent,
		logger,
	} = deps;

	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = RecrawlContentExtractedEvent.detailSchema.parse(envelope.detail);

			const sources = await listAvailableTierSources(detail.url);
			if (sources.length === 0) {
				/* Throw so SQS redelivers after the visibility timeout. Same
				 * worker→S3→EventBridge→SQS race as in select-most-complete-content-handler;
				 * after maxReceiveCount the DLQ handler flips crawlStatus to "failed". */
				logger.warn("[RecrawlContentExtracted] no tier sources available, retrying", {
					url: detail.url,
				});
				throw new Error(
					`no tier sources available for ${detail.url}; will retry`,
				);
			}

			let winnerTier: TierSource["tier"] | undefined;
			let reason: string;
			if (sources.length === 1) {
				winnerTier = sources[0].tier;
				reason = "only available tier";
			} else {
				const decision = await selectMostCompleteContent({
					url: detail.url,
					candidates: sources.map((source) => ({
						tier: source.tier,
						title: source.metadata.title,
						wordCount: source.metadata.wordCount,
						html: source.html,
					})),
				});
				logger.info("[RecrawlContentExtracted] selector decision", {
					url: detail.url,
					winner: decision.winner,
					reason: decision.reason,
				});
				if (decision.winner === "tie") {
					winnerTier = undefined;
					reason = decision.reason;
				} else {
					winnerTier = decision.winner;
					reason = decision.reason;
				}
			}

			if (winnerTier !== undefined) {
				const winnerSource = sources.find((source) => source.tier === winnerTier);
				assert(winnerSource, `winner tier ${winnerTier} missing from candidate set`);

				await promoteTierToCanonical({
					url: detail.url,
					tier: winnerTier,
					metadata: winnerSource.metadata,
				});

				logger.info("[RecrawlContentExtracted] promoted tier to canonical", {
					url: detail.url,
					tier: winnerTier,
					reason,
				});
			} else {
				logger.info("[RecrawlContentExtracted] tie kept canonical unchanged", {
					url: detail.url,
					reason,
				});
			}

			/* Always dispatch — the user-save chain gates this on canonical
			 * change to dedup re-saves; recrawl explicitly opts out so the
			 * operator gets a fresh AI excerpt every time. */
			await dispatchGenerateSummary({ url: detail.url });

			await publishEvent({
				source: RecrawlCompletedEvent.source,
				detailType: RecrawlCompletedEvent.detailType,
				detail: JSON.stringify({ url: detail.url }),
			});
		}
	};
}
