import { createHash } from "node:crypto";
import type { HutchLogger } from "@packages/hutch-logger";
import type { CrawlArticle, ThumbnailImage } from "@packages/crawl-article";
import { ArticleResourceUniqueId } from "./article-resource-unique-id";
import type { ParseHtml } from "../article-parser/article-parser.types";
import type { DownloadMedia, DownloadedMedia } from "./download-media";
import type { PutImageObject } from "./s3-put-image-object";
import type { UpdateThumbnailUrl } from "./update-thumbnail-url";

export type PutObject = (params: { key: string; content: string }) => Promise<string>;
export type UpdateContentLocation = (params: { url: string; contentLocation: string }) => Promise<void>;
export type ProcessContent = (params: { html: string; media: DownloadedMedia[] }) => Promise<string>;

export function initSaveLinkWork(deps: {
	crawlArticle: CrawlArticle;
	parseHtml: ParseHtml;
	putObject: PutObject;
	putImageObject: PutImageObject;
	updateContentLocation: UpdateContentLocation;
	downloadMedia: DownloadMedia;
	processContent: ProcessContent;
	updateThumbnailUrl: UpdateThumbnailUrl;
	imagesCdnBaseUrl: string;
	logger: HutchLogger;
	logPrefix: string;
}): { saveLinkWork: (url: string) => Promise<void> } {
	const {
		crawlArticle,
		parseHtml,
		putObject,
		putImageObject,
		updateContentLocation,
		downloadMedia,
		processContent,
		updateThumbnailUrl,
		imagesCdnBaseUrl,
		logger,
		logPrefix,
	} = deps;

	const saveLinkWork = async (url: string): Promise<void> => {
		const crawlResult = await crawlArticle({ url, fetchThumbnail: true });
		if (crawlResult.status !== "fetched") {
			logger.info(`${logPrefix} could not fetch article, skipping content`, { url, status: crawlResult.status });
			return;
		}

		const parseResult = parseHtml({ url, html: crawlResult.html });
		if (!parseResult.ok) {
			logger.info(`${logPrefix} could not parse article, skipping content`, { url, reason: parseResult.reason });
			return;
		}

		const { article } = parseResult;
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(url);

		const media = await downloadMedia({
			html: article.content,
			articleResourceUniqueId,
		});

		const html = await processContent({ html: article.content, media });

		const key = articleResourceUniqueId.toS3ContentKey();
		const contentLocation = await putObject({ key, content: html });
		await updateContentLocation({ url, contentLocation });
		logger.info(`${logPrefix} saved content to S3`, { url, contentLocation });

		if (crawlResult.thumbnailImage) {
			const cdnUrl = await uploadThumbnail({
				thumbnailImage: crawlResult.thumbnailImage,
				articleResourceUniqueId,
				putImageObject,
				imagesCdnBaseUrl,
			});
			await updateThumbnailUrl({ url, imageUrl: cdnUrl });
			logger.info(`${logPrefix} saved thumbnail to S3`, { url, cdnUrl });
		}
	};

	return { saveLinkWork };
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
