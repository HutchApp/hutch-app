import assert from "node:assert";
import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import type { DispatchCommand, PublishEvent } from "@packages/hutch-infra-components/runtime";
import {
	type GenerateSummaryCommand,
	RecrawlContentExtractedEvent,
	RecrawlCompletedEvent,
} from "@packages/hutch-infra-components";
import type { MarkCrawlReady } from "../crawl-article-state/article-crawl.types";
import type { ListAvailableTierSources } from "./list-available-tier-sources";
import type { SelectMostCompleteContent } from "./select-content";
import type { PromoteTierToCanonical } from "./promote-tier-to-canonical";
import type { FindContentSourceTier } from "./find-content-source-tier";
import type { TierSource } from "./tier-source.types";

export function initRecrawlContentExtractedHandler(deps: {
	listAvailableTierSources: ListAvailableTierSources;
	selectMostCompleteContent: SelectMostCompleteContent;
	promoteTierToCanonical: PromoteTierToCanonical;
	findContentSourceTier: FindContentSourceTier;
	markCrawlReady: MarkCrawlReady;
	dispatchGenerateSummary: DispatchCommand<typeof GenerateSummaryCommand>;
	publishEvent: PublishEvent;
	logger: HutchLogger;
}): SQSHandler {
	const {
		listAvailableTierSources,
		selectMostCompleteContent,
		promoteTierToCanonical,
		findContentSourceTier,
		markCrawlReady,
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
					const existingTier = await findContentSourceTier(detail.url);
					if (existingTier) {
						/* Recrawl tie + canonical already set: keep canonical
						 * exactly as-is; the operator still gets a fresh summary
						 * via the unconditional dispatchGenerateSummary below. */
						winnerTier = undefined;
						reason = decision.reason;
					} else {
						/* Tie with no canonical yet — i.e. recovering a row that
						 * the user-save flow left stuck because of the same tie
						 * pathology. Default to tier-1 (Readability) when present,
						 * else tier-0; both candidates carry identical content by
						 * definition of "tie", so this is a deterministic
						 * tiebreaker rather than a quality call. */
						const fallback =
							sources.find((source) => source.tier === "tier-1") ??
							sources.find((source) => source.tier === "tier-0");
						assert(fallback, "tie with no candidate tiers should be unreachable");
						winnerTier = fallback.tier;
						reason = `tie on recrawl recovery; defaulted to ${fallback.tier}`;
					}
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
				// Tie + canonical preserved: promoteTierToCanonical (the only writer
				// of crawlStatus="ready") was skipped, so we must flip the row back
				// out of the "pending" state that admin/recrawl's
				// forceMarkCrawlPending unconditionally wrote — otherwise readers
				// (and the Tier 1+ canary) poll a forever-"pending" row that never
				// resolves, since the canonical content is already on disk.
				await markCrawlReady({ url: detail.url });
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
