import { createHash } from "node:crypto";
import type { HutchLogger } from "@packages/hutch-logger";
import type { CrawlArticle, ThumbnailImage } from "@packages/crawl-article";
import type { MarkCrawlFailed, MarkCrawlReady } from "../crawl-article-state/article-crawl.types";
import { ArticleResourceUniqueId } from "./article-resource-unique-id";
import type { ParseHtml } from "../article-parser/article-parser.types";
import type { DownloadMedia, DownloadedMedia } from "./download-media";
import type { PutImageObject } from "./s3-put-image-object";
import type { UpdateThumbnailUrl } from "./update-thumbnail-url";
import type { UpdateFetchTimestamp } from "./update-fetch-timestamp-handler";
import type { UpdateArticleMetadata } from "./update-article-metadata";
import type { LogParseError } from "./log-parse-error";
import { estimatedReadTimeFromWordCount } from "./estimated-read-time";

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
	markCrawlFailed: MarkCrawlFailed;
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
		markCrawlFailed,
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
			// Parse failures are terminal: re-running the worker against the
			// same HTML will re-fail the same way. Flip the crawl state to
			// `failed` immediately so readers and the Tier 1+ canary see the
			// terminal state on the next poll, instead of waiting for SQS
			// retries → DLQ (~90s+) before the DLQ handler updates it.
			await markCrawlFailed({ url, reason: parseResult.reason });
			throw new Error(`crawl failed for ${url}: ${parseResult.reason}`);
		}

		const { article } = parseResult;
		const articleResourceUniqueId = ArticleResourceUniqueId.parse(url);

		// Wrap the post-parse pipeline so a thrown step (downloadMedia,
		// processContent, putObject, updateContentLocation, updateFetchTimestamp,
		// uploadThumbnail, updateThumbnailUrl, markCrawlReady) lands a structured
		// event in the parse-errors stream — without this the failure was visible
		// only as a raw console.error in the Lambda log group and was silently
		// missing from the dashboard's parse-errors widgets. The crawlStatus row
		// is left as-is: SQS retries the message and the DLQ handler owns the
		// terminal failed state, mirroring the existing crawl-failure path.
		try {
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
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logParseError({ url, reason: `post-parse-step-failed: ${message}` });
			throw error;
		}

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
