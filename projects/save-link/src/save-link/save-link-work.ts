import { createHash } from "node:crypto";
import type { HutchLogger } from "@packages/hutch-logger";
import type { CrawlArticle, ThumbnailImage } from "@packages/crawl-article";
import type { MarkCrawlReady } from "../crawl-article-state/article-crawl.types";
import { ArticleResourceUniqueId } from "./article-resource-unique-id";
import type { ParseHtml } from "../article-parser/article-parser.types";
import type { DownloadMedia, DownloadedMedia } from "./download-media";
import type { PutImageObject } from "./s3-put-image-object";
import type { UpdateThumbnailUrl } from "./update-thumbnail-url";
import type { UpdateFetchTimestamp } from "./update-fetch-timestamp-handler";
import type { UpdateArticleMetadata } from "./update-article-metadata";
import type { LogParseError } from "./log-parse-error";

const WORDS_PER_MINUTE = 238;

function estimatedReadTimeFromWordCount(wordCount: number): number {
	if (wordCount <= 0) return 1;
	return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

export type PutObject = (params: { key: string; content: string }) => Promise<string>;
export type UpdateContentLocation = (params: { url: string; contentLocation: string }) => Promise<void>;
export type ProcessContent = (params: { html: string; media: DownloadedMedia[] }) => Promise<string>;

/* c8 ignore next -- V8 block coverage phantom on typed-parameter destructuring, see bcoe/c8#319 */
export function initSaveLinkWork(deps: {
	crawlArticle: CrawlArticle;
	parseHtml: ParseHtml;
	putObject: PutObject;
	putImageObject: PutImageObject;
	updateContentLocation: UpdateContentLocation;
	updateFetchTimestamp: UpdateFetchTimestamp;
	updateArticleMetadata: UpdateArticleMetadata;
	markCrawlReady: MarkCrawlReady;
	downloadMedia: DownloadMedia;
	processContent: ProcessContent;
	updateThumbnailUrl: UpdateThumbnailUrl;
	imagesCdnBaseUrl: string;
	now: () => Date;
	logger: HutchLogger;
	logParseError: LogParseError;
	logPrefix: string;
}): { saveLinkWork: (url: string) => Promise<void> } {
	const {
		crawlArticle,
		parseHtml,
		putObject,
		putImageObject,
		updateContentLocation,
		updateFetchTimestamp,
		updateArticleMetadata,
		markCrawlReady,
		downloadMedia,
		processContent,
		updateThumbnailUrl,
		imagesCdnBaseUrl,
		now,
		logger,
		logParseError,
		logPrefix,
	} = deps;

	const saveLinkWork = async (url: string): Promise<void> => {
		const crawlResult = await crawlArticle({ url, fetchThumbnail: true });
		if (crawlResult.status !== "fetched") {
			const reason = `crawl-${crawlResult.status}`;
			logParseError({ url, reason });
			throw new Error(`crawl failed for ${url}: ${reason}`);
		}

		const parseResult = parseHtml({ url, html: crawlResult.html });
		if (!parseResult.ok) {
			logParseError({ url, reason: parseResult.reason });
			throw new Error(`crawl failed for ${url}: ${parseResult.reason}`);
		}

		const { article } = parseResult;
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(url);

		await updateArticleMetadata({
			url,
			title: article.title,
			siteName: article.siteName,
			excerpt: article.excerpt,
			wordCount: article.wordCount,
			estimatedReadTime: estimatedReadTimeFromWordCount(article.wordCount),
			imageUrl: article.imageUrl,
		});

		const media = await downloadMedia({
			html: article.content,
			articleResourceUniqueId,
		});

		const html = await processContent({ html: article.content, media });

		const key = articleResourceUniqueId.toS3ContentKey();
		const contentLocation = await putObject({ key, content: html });
		await updateContentLocation({ url, contentLocation });
		await updateFetchTimestamp({
			url,
			contentFetchedAt: now().toISOString(),
			etag: crawlResult.etag,
			lastModified: crawlResult.lastModified,
		});

		if (crawlResult.thumbnailImage) {
			const cdnUrl = await uploadThumbnail({
				thumbnailImage: crawlResult.thumbnailImage,
				articleResourceUniqueId,
				putImageObject,
				imagesCdnBaseUrl,
			});
			await updateThumbnailUrl({ url, imageUrl: cdnUrl });
		}

		await markCrawlReady({ url });

		logger.info(`${logPrefix} saved`, { url, hasThumbnail: crawlResult.thumbnailImage ? 1 : 0 });
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
