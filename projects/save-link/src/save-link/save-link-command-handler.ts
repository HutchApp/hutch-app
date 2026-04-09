import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import { SaveLinkCommand } from "./index";
import { ArticleUniqueId } from "./article-unique-id";
import type { ParseArticle } from "../article-parser/article-parser.types";
import type { DownloadMedia } from "./download-media";
import { processContentWithLocalMedia } from "./process-content-with-local-media";
import type { UpdateThumbnailUrl } from "./update-thumbnail-url";

export type PutObject = (params: { key: string; content: string }) => Promise<string>;
export type UpdateContentLocation = (params: { url: string; contentLocation: string }) => Promise<void>;
type PublishLinkSaved = (params: { url: string; userId: string }) => Promise<void>;

function contentS3Key(articleUniqueId: ArticleUniqueId): string {
	return `content/${encodeURIComponent(articleUniqueId.value)}/content.html`;
}

export function initSaveLinkCommandHandler(deps: {
	parseArticle: ParseArticle;
	putObject: PutObject;
	updateContentLocation: UpdateContentLocation;
	publishLinkSaved: PublishLinkSaved;
	downloadMedia: DownloadMedia;
	updateThumbnailUrl: UpdateThumbnailUrl;
	logger: HutchLogger;
}): SQSHandler {
	const { parseArticle, putObject, updateContentLocation, publishLinkSaved, downloadMedia, updateThumbnailUrl, logger } = deps;

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
			const articleUniqueId = ArticleUniqueId.parse(detail.url);

			const media = await downloadMedia({
				html: article.content,
				thumbnailUrl: article.imageUrl,
				articleUniqueId,
			});

			const { html, thumbnailUrl } = await processContentWithLocalMedia({
				html: article.content,
				thumbnailUrl: article.imageUrl,
				media,
			});

			const key = contentS3Key(articleUniqueId);
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
