import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import type { CrawlArticle } from "@packages/crawl-article";
import type { PublishEvent } from "@packages/hutch-infra-components/runtime";
import { CrawlArticleCompletedEvent } from "@packages/hutch-infra-components";
import { SaveLinkCommand } from "./index";
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

export type { PutObject, UpdateContentLocation } from "./save-link-work";

type PublishLinkSaved = (params: { url: string; userId: string }) => Promise<void>;

export function initSaveLinkCommandHandler(deps: {
	crawlArticle: CrawlArticle;
	parseHtml: ParseHtml;
	putObject: PutObject;
	putImageObject: PutImageObject;
	updateContentLocation: UpdateContentLocation;
	updateFetchTimestamp: UpdateFetchTimestamp;
	updateArticleMetadata: UpdateArticleMetadata;
	markCrawlReady: MarkCrawlReady;
	publishLinkSaved: PublishLinkSaved;
	publishEvent: PublishEvent;
	downloadMedia: DownloadMedia;
	processContent: ProcessContent;
	updateThumbnailUrl: UpdateThumbnailUrl;
	imagesCdnBaseUrl: string;
	now: () => Date;
	logger: HutchLogger;
	logParseError: LogParseError;
}): SQSHandler {
	const { publishLinkSaved, publishEvent, logger } = deps;

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
		logPrefix: "[SaveLinkCommand]",
	});

	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = SaveLinkCommand.detailSchema.parse(envelope.detail);

			await saveLinkWork(detail.url);

			await publishEvent({
				source: CrawlArticleCompletedEvent.source,
				detailType: CrawlArticleCompletedEvent.detailType,
				detail: JSON.stringify({ url: detail.url }),
			});

			await publishLinkSaved({ url: detail.url, userId: detail.userId });
			logger.info("[SaveLinkCommand] published LinkSavedEvent", { url: detail.url });
		}
	};
}
