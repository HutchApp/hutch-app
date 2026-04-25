import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import { SaveLinkRawHtmlCommand, type LogCrawlOutcome, type LogParseError } from "@packages/hutch-infra-components";
import { ArticleResourceUniqueId } from "../save-link/article-resource-unique-id";
import type { ParseHtml } from "../article-parser/article-parser.types";
import type { DownloadMedia } from "../save-link/download-media";
import type { ProcessContent } from "../save-link/save-link-work";
import { estimatedReadTimeFromWordCount } from "../save-link/estimated-read-time";
import type { ReadTierSnapshot } from "../crawl-article-state/read-tier-snapshot";
import type { ReadPendingHtml } from "./read-pending-html";
import type { PutSourceContent } from "./source-content.types";
import type { ReadCanonicalContent } from "./canonical-content.types";
import type { PromoteSourceToCanonical } from "./promote-source.types";
import type { SelectMostCompleteContent } from "./select-content";
import type { MarkCrawlFailed, MarkCrawlReady } from "../crawl-article-state/article-crawl.types";

const TIER = "tier-0";

type PublishLinkSaved = (params: { url: string; userId: string }) => Promise<void>;

/* c8 ignore next -- V8 block coverage phantom on typed-parameter destructuring, see bcoe/c8#319 */
export function initSaveLinkRawHtmlCommandHandler(deps: {
	readPendingHtml: ReadPendingHtml;
	parseHtml: ParseHtml;
	downloadMedia: DownloadMedia;
	processContent: ProcessContent;
	putSourceContent: PutSourceContent;
	readCanonicalContent: ReadCanonicalContent;
	promoteSourceToCanonical: PromoteSourceToCanonical;
	selectMostCompleteContent: SelectMostCompleteContent;
	publishLinkSaved: PublishLinkSaved;
	markCrawlReady: MarkCrawlReady;
	markCrawlFailed: MarkCrawlFailed;
	logger: HutchLogger;
	logParseError: LogParseError;
	logCrawlOutcome: LogCrawlOutcome;
	readTierSnapshot: ReadTierSnapshot;
}): SQSHandler {
	const {
		readPendingHtml,
		parseHtml,
		downloadMedia,
		processContent,
		putSourceContent,
		readCanonicalContent,
		promoteSourceToCanonical,
		selectMostCompleteContent,
		publishLinkSaved,
		markCrawlReady,
		markCrawlFailed,
		logger,
		logParseError,
		logCrawlOutcome,
		readTierSnapshot,
	} = deps;

	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = SaveLinkRawHtmlCommand.detailSchema.parse(envelope.detail);

			const rawHtml = await readPendingHtml(detail.url);
			const parseResult = parseHtml({ url: detail.url, html: rawHtml });
			if (!parseResult.ok) {
				logParseError({ url: detail.url, reason: parseResult.reason });
				const snapshot = await readTierSnapshot({ url: detail.url });
				logCrawlOutcome({
					url: detail.url,
					thisTier: TIER,
					thisTierStatus: "failed",
					otherTierStatus: snapshot.tier1Status,
					pickedTier: snapshot.pickedTier,
				});
				/* Parse errors are terminal on the same HTML — re-running yields the
				 * same failure. Flip crawlStatus immediately so the reader shows a
				 * failed state at t+0 instead of polling for ~90s until SQS exhausts
				 * retries and the DLQ handler marks failed. Snapshot is read above
				 * before this flip so otherTierStatus reflects tier-1's pre-flip
				 * state. Re-throw preserves the SQS retry + DLQ observability path. */
				await markCrawlFailed({ url: detail.url, reason: parseResult.reason });
				throw new Error(`save-link-raw-html parse failed for ${detail.url}: ${parseResult.reason}`);
			}

			const articleResourceUniqueId = ArticleResourceUniqueId.parse(detail.url);
			const media = await downloadMedia({
				html: parseResult.article.content,
				articleResourceUniqueId,
			});
			const processedHtml = await processContent({ html: parseResult.article.content, media });

			await putSourceContent({ url: detail.url, tier: TIER, html: processedHtml });
			logger.info("[SaveLinkRawHtmlCommand] saved tier-0 source", {
				url: detail.url,
				// Captured tab title from the extension — often includes site branding
				// and may differ from the readability-extracted title. Useful in logs
				// for correlating a save with what the user actually had open.
				capturedTitle: detail.title,
			});

			const promoteMetadata = {
				title: parseResult.article.title,
				siteName: parseResult.article.siteName,
				excerpt: parseResult.article.excerpt,
				wordCount: parseResult.article.wordCount,
				estimatedReadTime: estimatedReadTimeFromWordCount(parseResult.article.wordCount),
				imageUrl: parseResult.article.imageUrl,
			};

			const canonical = await readCanonicalContent({ url: detail.url });
			let canonicalChanged = false;

			if (!canonical) {
				await promoteSourceToCanonical({ url: detail.url, tier: TIER, metadata: promoteMetadata });
				canonicalChanged = true;
				logger.info("[SaveLinkRawHtmlCommand] no canonical; promoted tier-0", { url: detail.url });
			} else {
				const decision = await selectMostCompleteContent({
					url: detail.url,
					candidates: [
						{
							source: "tier-0",
							title: parseResult.article.title,
							wordCount: parseResult.article.wordCount,
							html: processedHtml,
						},
						{
							source: "canonical",
							title: canonical.metadata.title,
							wordCount: canonical.metadata.wordCount,
							html: canonical.html,
						},
					],
				});
				logger.info("[SaveLinkRawHtmlCommand] selector decision", {
					url: detail.url,
					winner: decision.winner,
					reason: decision.reason,
				});
				if (decision.winner === "tier-0") {
					await promoteSourceToCanonical({ url: detail.url, tier: TIER, metadata: promoteMetadata });
					canonicalChanged = true;
				}
			}

			/* A canonical now exists (just-promoted, kept-after-contest, or kept-on-tie),
			 * so the row has at least one good readable source. Resetting crawlStatus
			 * unconditionally also corrects rows pinned to "failed" by an earlier tier-1
			 * attempt — without this, the reader-slot short-circuits to renderReaderFailed
			 * even after a successful tier-0 promotion. Run before publishLinkSaved so a
			 * publish failure still leaves the row consistent (good content + ready). */
			await markCrawlReady({ url: detail.url });

			if (canonicalChanged) {
				await publishLinkSaved({ url: detail.url, userId: detail.userId });
			}

			const snapshot = await readTierSnapshot({ url: detail.url });
			logCrawlOutcome({
				url: detail.url,
				thisTier: TIER,
				thisTierStatus: "success",
				otherTierStatus: snapshot.tier1Status,
				pickedTier: snapshot.pickedTier,
			});
		}
	};
}
