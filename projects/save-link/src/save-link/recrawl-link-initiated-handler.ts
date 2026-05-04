import assert from "node:assert";
import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import type { CrawlArticle } from "@packages/crawl-article";
import type { PublishEvent } from "@packages/hutch-infra-components/runtime";
import {
	RecrawlLinkInitiatedEvent,
	RecrawlContentExtractedEvent,
} from "@packages/hutch-infra-components";
import type { MarkCrawlFailed, MarkCrawlStage } from "../crawl-article-state/article-crawl.types";
import type { ParseHtml } from "../article-parser/article-parser.types";
import type { DownloadMedia } from "./download-media";
import type { PutImageObject } from "./s3-put-image-object";
import type { UpdateFetchTimestamp } from "./update-fetch-timestamp-handler";
import type { LogCrawlOutcome, LogParseError } from "@packages/hutch-infra-components";
import type { ReadTierSnapshot } from "../crawl-article-state/read-tier-snapshot";
import { initSaveLinkWork, type ProcessContent } from "./save-link-work";
import type { PutTierSource } from "../select-content/put-tier-source";

export function initRecrawlLinkInitiatedHandler(deps: {
	crawlArticle: CrawlArticle;
	parseHtml: ParseHtml;
	putTierSource: PutTierSource;
	putImageObject: PutImageObject;
	updateFetchTimestamp: UpdateFetchTimestamp;
	markCrawlFailed: MarkCrawlFailed;
	markCrawlStage: MarkCrawlStage;
	publishEvent: PublishEvent;
	downloadMedia: DownloadMedia;
	processContent: ProcessContent;
	imagesCdnBaseUrl: string;
	now: () => Date;
	logger: HutchLogger;
	logParseError: LogParseError;
	logCrawlOutcome: LogCrawlOutcome;
	readTierSnapshot: ReadTierSnapshot;
}): SQSHandler {
	const { publishEvent, logger } = deps;

	const { saveLinkWork } = initSaveLinkWork({
		crawlArticle: deps.crawlArticle,
		parseHtml: deps.parseHtml,
		putTierSource: deps.putTierSource,
		putImageObject: deps.putImageObject,
		updateFetchTimestamp: deps.updateFetchTimestamp,
		markCrawlFailed: deps.markCrawlFailed,
		markCrawlStage: deps.markCrawlStage,
		downloadMedia: deps.downloadMedia,
		processContent: deps.processContent,
		imagesCdnBaseUrl: deps.imagesCdnBaseUrl,
		now: deps.now,
		logger,
		logParseError: deps.logParseError,
		logCrawlOutcome: deps.logCrawlOutcome,
		readTierSnapshot: deps.readTierSnapshot,
		logPrefix: "[RecrawlLinkInitiated]",
	});

	return async (event, context) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = RecrawlLinkInitiatedEvent.detailSchema.parse(envelope.detail);

			logger.info("[RecrawlLinkInitiated] processing", { url: detail.url });

			// Race against the Lambda's remaining budget. If saveLinkWork hangs
			// past the deadline (e.g. an origin that accepts the TCP connection
			// then stalls), AWS hard-kills the Lambda before any catch runs —
			// so crawlStatus only flips to 'failed' after SQS retries exhaust
			// (~180s with visibility-timeout=60 × maxReceiveCount=3), exactly
			// racing the Tier 1+ canary's 180s budget. Rejecting the race ~2s
			// before Lambda death leaves enough headroom for the markCrawlFailed
			// DDB write (~50ms) and clean exit.
			const workBudgetMs = context.getRemainingTimeInMillis() - 2000;
			let timeoutHandle: NodeJS.Timeout | undefined;
			try {
				await Promise.race([
					saveLinkWork(detail.url),
					new Promise<never>((_, reject) => {
						timeoutHandle = setTimeout(
							() => reject(new Error(`recrawl worker exceeded ${workBudgetMs}ms budget`)),
							workBudgetMs,
						);
					}),
				]);
			} catch (err) {
				assert(err instanceof Error, "saveLinkWork and the budget timer always reject with an Error");
				await deps.markCrawlFailed({ url: detail.url, reason: err.message });
				throw err;
			} finally {
				clearTimeout(timeoutHandle);
			}

			await publishEvent({
				source: RecrawlContentExtractedEvent.source,
				detailType: RecrawlContentExtractedEvent.detailType,
				detail: JSON.stringify({ url: detail.url }),
			});
			logger.info("[RecrawlLinkInitiated] emitted RecrawlContentExtractedEvent", {
				url: detail.url,
			});
		}
	};
}
