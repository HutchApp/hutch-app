import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import type { CrawlArticle } from "@packages/crawl-article";
import type { PublishEvent } from "@packages/hutch-infra-components/runtime";
import {
	CrawlArticleCompletedEvent,
	SaveAnonymousLinkCommand,
} from "@packages/hutch-infra-components";
import type { MarkCrawlReady } from "../crawl-article-state/article-crawl.types";
import type { ParseHtml } from "../article-parser/article-parser.types";
import type { DownloadMedia } from "./download-media";
import type { PutImageObject } from "./s3-put-image-object";
import type { UpdateThumbnailUrl } from "./update-thumbnail-url";
import type { UpdateFetchTimestamp } from "./update-fetch-timestamp-handler";
import type { UpdateArticleMetadata } from "./update-article-metadata";
import type { LogParseError } from "./log-parse-error";
import {
	initSaveLinkWork,
	type ProcessContent,
	type PutObject,
	type UpdateContentLocation,
} from "./save-link-work";

type PublishAnonymousLinkSaved = (params: { url: string }) => Promise<void>;

export function initSaveAnonymousLinkCommandHandler(deps: {
	crawlArticle: CrawlArticle;
	parseHtml: ParseHtml;
	putObject: PutObject;
	putImageObject: PutImageObject;
	updateContentLocation: UpdateContentLocation;
	updateFetchTimestamp: UpdateFetchTimestamp;
	updateArticleMetadata: UpdateArticleMetadata;
	markCrawlReady: MarkCrawlReady;
	publishAnonymousLinkSaved: PublishAnonymousLinkSaved;
	publishEvent: PublishEvent;
	downloadMedia: DownloadMedia;
	processContent: ProcessContent;
	updateThumbnailUrl: UpdateThumbnailUrl;
	imagesCdnBaseUrl: string;
	now: () => Date;
	logger: HutchLogger;
	logParseError: LogParseError;
}): SQSHandler {
	const { publishAnonymousLinkSaved, publishEvent, logger } = deps;

	const { saveLinkWork } = initSaveLinkWork({
		crawlArticle: deps.crawlArticle,
		parseHtml: deps.parseHtml,
		putObject: deps.putObject,
		putImageObject: deps.putImageObject,
		updateContentLocation: deps.updateContentLocation,
		updateFetchTimestamp: deps.updateFetchTimestamp,
		updateArticleMetadata: deps.updateArticleMetadata,
		markCrawlReady: deps.markCrawlReady,
		downloadMedia: deps.downloadMedia,
		processContent: deps.processContent,
		updateThumbnailUrl: deps.updateThumbnailUrl,
		imagesCdnBaseUrl: deps.imagesCdnBaseUrl,
		now: deps.now,
		logger,
		logParseError: deps.logParseError,
		logPrefix: "[SaveAnonymousLinkCommand]",
	});

	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = SaveAnonymousLinkCommand.detailSchema.parse(envelope.detail);

			logger.info("[SaveAnonymousLinkCommand] processing", { url: detail.url });

			await saveLinkWork(detail.url);

			await publishEvent({
				source: CrawlArticleCompletedEvent.source,
				detailType: CrawlArticleCompletedEvent.detailType,
				detail: JSON.stringify({ url: detail.url }),
			});

			await publishAnonymousLinkSaved({ url: detail.url });
			logger.info("[SaveAnonymousLinkCommand] published AnonymousLinkSavedEvent", { url: detail.url });
		}
	};
}
