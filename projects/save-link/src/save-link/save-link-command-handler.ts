import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import { SaveLinkCommand } from "./index";
import { ArticleResourceUniqueId } from "./article-resource-unique-id";
import type { ParseArticle } from "../article-parser/article-parser.types";
import type { DownloadMedia, DownloadedMedia } from "./download-media";
import type { UpdateThumbnailUrl } from "./update-thumbnail-url";

export type PutObject = (params: { key: string; content: string }) => Promise<string>;
export type UpdateContentLocation = (params: { url: string; contentLocation: string }) => Promise<void>;
type PublishLinkSaved = (params: { url: string; userId: string }) => Promise<void>;
type ProcessContent = (params: { html: string; thumbnailUrl: string | undefined; media: DownloadedMedia[] }) => Promise<{ html: string; thumbnailUrl: string | undefined }>;

export function initSaveLinkCommandHandler(deps: {
	parseArticle: ParseArticle;
	putObject: PutObject;
	updateContentLocation: UpdateContentLocation;
	publishLinkSaved: PublishLinkSaved;
	downloadMedia: DownloadMedia;
	processContent: ProcessContent;
	updateThumbnailUrl: UpdateThumbnailUrl;
	logger: HutchLogger;
}): SQSHandler {
	const { parseArticle, putObject, updateContentLocation, publishLinkSaved, downloadMedia, processContent, updateThumbnailUrl, logger } = deps;

	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = SaveLinkCommand.detailSchema.parse(envelope.detail);

			logger.info("[SaveLinkCommand] processing", { url: detail.url, userId: detail.userId });

			const parseResult = await parseArticle(detail.url);
			if (!parseResult.ok) {
				logger.info("[SaveLinkCommand] could not fetch article, skipping content", { url: detail.url, reason: parseResult.reason });
				await publishLinkSaved({ url: detail.url, userId: detail.userId });
				continue;
			}

			const { article } = parseResult;
			const articleResourceUniqueId = ArticleResourceUniqueId.parse(detail.url);

			const media = await downloadMedia({
				html: article.content,
				thumbnailUrl: article.imageUrl,
				articleResourceUniqueId,
			});

			const { html, thumbnailUrl } = await processContent({
				html: article.content,
				thumbnailUrl: article.imageUrl,
				media,
			});

			const key = articleResourceUniqueId.toS3ContentKey();
			const contentLocation = await putObject({ key, content: html });
			await updateContentLocation({ url: detail.url, contentLocation });
			logger.info("[SaveLinkCommand] saved content to S3", { url: detail.url, contentLocation });

			if (thumbnailUrl && thumbnailUrl !== article.imageUrl) {
				await updateThumbnailUrl({ url: detail.url, imageUrl: thumbnailUrl });
				logger.info("[SaveLinkCommand] updated thumbnail URL", { url: detail.url });
			}

			await publishLinkSaved({ url: detail.url, userId: detail.userId });
			logger.info("[SaveLinkCommand] published LinkSavedEvent", { url: detail.url });
		}
	};
}
