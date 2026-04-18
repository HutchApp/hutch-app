import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import type { CrawlArticle } from "@packages/crawl-article";
import { SaveAnonymousLinkCommand } from "@packages/hutch-infra-components";
import type { ParseHtml } from "../article-parser/article-parser.types";
import type { DownloadMedia } from "./download-media";
import type { PutImageObject } from "./s3-put-image-object";
import type { UpdateThumbnailUrl } from "./update-thumbnail-url";
import type { UpdateFetchTimestamp } from "./update-fetch-timestamp-handler";
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
	publishAnonymousLinkSaved: PublishAnonymousLinkSaved;
	downloadMedia: DownloadMedia;
	processContent: ProcessContent;
	updateThumbnailUrl: UpdateThumbnailUrl;
	imagesCdnBaseUrl: string;
	now: () => Date;
	logger: HutchLogger;
}): SQSHandler {
	const { publishAnonymousLinkSaved, logger } = deps;

	const { saveLinkWork } = initSaveLinkWork({
		crawlArticle: deps.crawlArticle,
		parseHtml: deps.parseHtml,
		putObject: deps.putObject,
		putImageObject: deps.putImageObject,
		updateContentLocation: deps.updateContentLocation,
		updateFetchTimestamp: deps.updateFetchTimestamp,
		downloadMedia: deps.downloadMedia,
		processContent: deps.processContent,
		updateThumbnailUrl: deps.updateThumbnailUrl,
		imagesCdnBaseUrl: deps.imagesCdnBaseUrl,
		now: deps.now,
		logger,
		logPrefix: "[SaveAnonymousLinkCommand]",
	});

	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = SaveAnonymousLinkCommand.detailSchema.parse(envelope.detail);

			logger.info("[SaveAnonymousLinkCommand] processing", { url: detail.url });

			await saveLinkWork(detail.url);

			await publishAnonymousLinkSaved({ url: detail.url });
			logger.info("[SaveAnonymousLinkCommand] published AnonymousLinkSavedEvent", { url: detail.url });
		}
	};
}
