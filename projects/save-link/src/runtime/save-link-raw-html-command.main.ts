import { S3Client } from "@aws-sdk/client-s3";
import { consoleLogger } from "@packages/hutch-logger";
import { DEFAULT_CRAWL_HEADERS, initCrawlArticle } from "@packages/crawl-article";
import posthtml from "posthtml";
import urls from "@11ty/posthtml-urls";
import { requireEnv } from "../require-env";
import { initReadabilityParser } from "../article-parser/readability-parser";
import { theInformationPreParser } from "../article-parser/the-information-pre-parser";
import { initS3PutImageObject } from "../save-link/s3-put-image-object";
import { initDownloadMedia } from "../save-link/download-media";
import { initProcessContentWithLocalMedia } from "../save-link/process-content-with-local-media";
import { initReadPendingHtml } from "../save-link-raw-html/read-pending-html";
import { initPutSourceContent } from "../save-link-raw-html/put-source-content";
import { initSaveLinkRawHtmlCommandHandler } from "../save-link-raw-html/save-link-raw-html-command-handler";

const contentBucketName = requireEnv("CONTENT_BUCKET_NAME");
const pendingHtmlBucketName = requireEnv("PENDING_HTML_BUCKET_NAME");
const imagesCdnBaseUrl = requireEnv("IMAGES_CDN_BASE_URL");

const logError = (message: string, error?: Error) => consoleLogger.error(message, { error });
const s3Client = new S3Client({});
const crawlArticle = initCrawlArticle({ fetch: globalThis.fetch, logError, headers: { ...DEFAULT_CRAWL_HEADERS } });

const { parseHtml } = initReadabilityParser({
	crawlArticle,
	sitePreParsers: [theInformationPreParser],
	logError,
});

const { readPendingHtml } = initReadPendingHtml({
	client: s3Client,
	bucketName: pendingHtmlBucketName,
});

const { putSourceContent } = initPutSourceContent({
	client: s3Client,
	bucketName: contentBucketName,
});

const { putImageObject } = initS3PutImageObject({
	client: s3Client,
	bucketName: contentBucketName,
});

const downloadMedia = initDownloadMedia({
	putImageObject,
	logger: consoleLogger,
	fetch: globalThis.fetch,
	imagesCdnBaseUrl,
});

const processContent = initProcessContentWithLocalMedia({
	rewriteHtmlUrls: (html, rewriteUrl) => {
		const plugin = urls({ eachURL: rewriteUrl });
		return posthtml().use(plugin).process(html).then((result) => result.html);
	},
});

export const handler = initSaveLinkRawHtmlCommandHandler({
	readPendingHtml,
	parseHtml,
	downloadMedia,
	processContent,
	putSourceContent,
	logger: consoleLogger,
});
