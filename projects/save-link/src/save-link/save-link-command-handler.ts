import { createHash } from "node:crypto";
import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import type { CrawlArticle, ThumbnailImage } from "@packages/crawl-article";
import { SaveLinkCommand } from "./index";
import { ArticleResourceUniqueId } from "./article-resource-unique-id";
import type { ParseHtml } from "../article-parser/article-parser.types";
import type { DownloadMedia, DownloadedMedia } from "./download-media";
import type { PutImageObject } from "./s3-put-image-object";
import type { UpdateThumbnailUrl } from "./update-thumbnail-url";

export type PutObject = (params: { key: string; content: string }) => Promise<string>;
export type UpdateContentLocation = (params: { url: string; contentLocation: string }) => Promise<void>;
type PublishLinkSaved = (params: { url: string; userId: string }) => Promise<void>;
type ProcessContent = (params: { html: string; media: DownloadedMedia[] }) => Promise<string>;

export function initSaveLinkCommandHandler(deps: {
	crawlArticle: CrawlArticle;
	parseHtml: ParseHtml;
	putObject: PutObject;
	putImageObject: PutImageObject;
	updateContentLocation: UpdateContentLocation;
	publishLinkSaved: PublishLinkSaved;
	downloadMedia: DownloadMedia;
	processContent: ProcessContent;
	updateThumbnailUrl: UpdateThumbnailUrl;
	imagesCdnBaseUrl: string;
	logger: HutchLogger;
}): SQSHandler {
	const {
		crawlArticle,
		parseHtml,
		putObject,
		putImageObject,
		updateContentLocation,
		publishLinkSaved,
		downloadMedia,
		processContent,
		updateThumbnailUrl,
		imagesCdnBaseUrl,
		logger,
	} = deps;

	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = SaveLinkCommand.detailSchema.parse(envelope.detail);

			logger.info("[SaveLinkCommand] processing", { url: detail.url, userId: detail.userId });

			const crawlResult = await crawlArticle({ url: detail.url, fetchThumbnail: true });
			if (crawlResult.status !== "fetched") {
				logger.info("[SaveLinkCommand] could not fetch article, skipping content", { url: detail.url, status: crawlResult.status });
				await publishLinkSaved({ url: detail.url, userId: detail.userId });
				continue;
			}

			const parseResult = parseHtml({ url: detail.url, html: crawlResult.html });
			if (!parseResult.ok) {
				logger.info("[SaveLinkCommand] could not parse article, skipping content", { url: detail.url, reason: parseResult.reason });
				await publishLinkSaved({ url: detail.url, userId: detail.userId });
				continue;
			}

			const { article } = parseResult;
			const articleResourceUniqueId = ArticleResourceUniqueId.parse(detail.url);

			const media = await downloadMedia({
				html: article.content,
				articleResourceUniqueId,
			});

			const html = await processContent({ html: article.content, media });

			const key = articleResourceUniqueId.toS3ContentKey();
			const contentLocation = await putObject({ key, content: html });
			await updateContentLocation({ url: detail.url, contentLocation });
			logger.info("[SaveLinkCommand] saved content to S3", { url: detail.url, contentLocation });

			if (crawlResult.thumbnailImage) {
				const cdnUrl = await uploadThumbnail({
					thumbnailImage: crawlResult.thumbnailImage,
					articleResourceUniqueId,
					putImageObject,
					imagesCdnBaseUrl,
				});
				await updateThumbnailUrl({ url: detail.url, imageUrl: cdnUrl });
				logger.info("[SaveLinkCommand] saved thumbnail to S3", { url: detail.url, cdnUrl });
			}

			await publishLinkSaved({ url: detail.url, userId: detail.userId });
			logger.info("[SaveLinkCommand] published LinkSavedEvent", { url: detail.url });
		}
	};
}

async function uploadThumbnail(args: {
	thumbnailImage: ThumbnailImage;
	articleResourceUniqueId: ArticleResourceUniqueId;
	putImageObject: PutImageObject;
	imagesCdnBaseUrl: string;
}): Promise<string> {
	const { thumbnailImage, articleResourceUniqueId, putImageObject, imagesCdnBaseUrl } = args;
	const hash = createHash("sha256").update(thumbnailImage.url).digest("hex").slice(0, 16);
	const filename = `${hash}${thumbnailImage.extension}`;
	const key = articleResourceUniqueId.toS3ImageKey(filename);
	await putImageObject({ key, body: thumbnailImage.body, contentType: thumbnailImage.contentType });
	return articleResourceUniqueId.toImageCdnUrl({ baseUrl: imagesCdnBaseUrl, filename });
}
