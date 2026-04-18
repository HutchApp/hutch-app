import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { consoleLogger } from "@packages/hutch-logger";
import { EventBridgeClient, initEventBridgePublisher } from "@packages/hutch-infra-components/runtime";
import { AnonymousLinkSavedEvent } from "@packages/hutch-infra-components";
import { requireEnv } from "../require-env";
import { DEFAULT_CRAWL_HEADERS, initCrawlArticle } from "@packages/crawl-article";
import { parseHtml } from "../article-parser/readability-parser";
import { initS3PutObject } from "../save-link/s3-put-object";
import { initS3PutImageObject } from "../save-link/s3-put-image-object";
import { initUpdateContentLocation } from "../save-link/update-content-location";
import posthtml from "posthtml";
import urls from "@11ty/posthtml-urls";
import { initUpdateThumbnailUrl } from "../save-link/update-thumbnail-url";
import { initDownloadMedia } from "../save-link/download-media";
import { initSaveAnonymousLinkCommandHandler } from "../save-link/save-anonymous-link-command-handler";
import { initProcessContentWithLocalMedia } from "../save-link/process-content-with-local-media";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const contentBucketName = requireEnv("CONTENT_BUCKET_NAME");
const eventBusName = requireEnv("EVENT_BUS_NAME");
const imagesCdnBaseUrl = requireEnv("IMAGES_CDN_BASE_URL");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});
const logError = (message: string, error?: Error) => consoleLogger.error(message, { error });

const crawlArticle = initCrawlArticle({ fetch: globalThis.fetch, logError, headers: { ...DEFAULT_CRAWL_HEADERS } });

const { putObject } = initS3PutObject({
	client: s3Client,
	bucketName: contentBucketName,
});

const { putImageObject } = initS3PutImageObject({
	client: s3Client,
	bucketName: contentBucketName,
});

const { updateContentLocation } = initUpdateContentLocation({
	client,
	tableName: articlesTable,
});

const { updateThumbnailUrl } = initUpdateThumbnailUrl({
	client,
	tableName: articlesTable,
});

const downloadMedia = initDownloadMedia({
	putImageObject,
	logger: consoleLogger,
	fetch: globalThis.fetch,
	imagesCdnBaseUrl,
});

const { publishEvent } = initEventBridgePublisher({
	client: new EventBridgeClient({}),
	eventBusName,
});

const publishAnonymousLinkSaved = async (params: { url: string }) => {
	await publishEvent({
		source: AnonymousLinkSavedEvent.source,
		detailType: AnonymousLinkSavedEvent.detailType,
		detail: JSON.stringify({ url: params.url }),
	});
};

const processContent = initProcessContentWithLocalMedia({
	rewriteHtmlUrls: (html, rewriteUrl) => {
		const plugin = urls({ eachURL: rewriteUrl });
		return posthtml().use(plugin).process(html).then((result) => result.html);
	},
});

export const handler = initSaveAnonymousLinkCommandHandler({
	crawlArticle,
	parseHtml,
	putObject,
	putImageObject,
	updateContentLocation,
	publishAnonymousLinkSaved,
	downloadMedia,
	processContent,
	updateThumbnailUrl,
	imagesCdnBaseUrl,
	logger: consoleLogger,
});
