import { createDynamoDocumentClient } from "@packages/hutch-storage-client";
import { S3Client } from "@aws-sdk/client-s3";
import { HutchLogger, consoleLogger } from "@packages/hutch-logger";
import { EventBridgeClient, initEventBridgePublisher } from "@packages/hutch-infra-components/runtime";
import { LinkSavedEvent, type ParseErrorEvent, initLogParseError, initLogCrawlOutcome, type CrawlOutcomeEvent } from "@packages/hutch-infra-components";
import { requireEnv } from "../require-env";
import { DEFAULT_CRAWL_HEADERS, initCrawlArticle } from "@packages/crawl-article";
import { initReadabilityParser } from "../article-parser/readability-parser";
import { theInformationPreParser } from "../article-parser/the-information-pre-parser";
import { initS3PutObject } from "../save-link/s3-put-object";
import { initS3PutImageObject } from "../save-link/s3-put-image-object";
import { initUpdateContentLocation } from "../save-link/update-content-location";
import posthtml from "posthtml";
import urls from "@11ty/posthtml-urls";
import { initUpdateThumbnailUrl } from "../save-link/update-thumbnail-url";
import { initUpdateFetchTimestamp } from "../save-link/update-fetch-timestamp";
import { initUpdateArticleMetadata } from "../save-link/update-article-metadata";
import { initDynamoDbArticleCrawl } from "../crawl-article-state/dynamodb-article-crawl";
import { initCheckTier0SourceExistsS3 } from "../crawl-article-state/check-tier-0-source-exists-s3";
import { initReadArticleCrawlStateDynamoDb } from "../crawl-article-state/read-article-crawl-state-dynamodb";
import { initReadTierSnapshot } from "../crawl-article-state/read-tier-snapshot";
import { initDownloadMedia } from "../save-link/download-media";
import { initSaveLinkCommandHandler } from "../save-link/save-link-command-handler";
import { initProcessContentWithLocalMedia } from "../save-link/process-content-with-local-media";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const contentBucketName = requireEnv("CONTENT_BUCKET_NAME");
const eventBusName = requireEnv("EVENT_BUS_NAME");
const imagesCdnBaseUrl = requireEnv("IMAGES_CDN_BASE_URL");

const client = createDynamoDocumentClient();
const s3Client = new S3Client({});
const logError = (message: string, error?: Error) => consoleLogger.error(message, { error });

const crawlArticle = initCrawlArticle({ fetch: globalThis.fetch, logError, headers: { ...DEFAULT_CRAWL_HEADERS } });

const { parseHtml } = initReadabilityParser({
	crawlArticle,
	sitePreParsers: [theInformationPreParser],
	logError,
});

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

const { updateFetchTimestamp } = initUpdateFetchTimestamp({
	client,
	tableName: articlesTable,
});

const { updateArticleMetadata } = initUpdateArticleMetadata({
	client,
	tableName: articlesTable,
});

const { markCrawlReady, markCrawlFailed, markCrawlStage } = initDynamoDbArticleCrawl({
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

const publishLinkSaved = async (params: { url: string; userId: string }) => {
	await publishEvent({
		source: LinkSavedEvent.source,
		detailType: LinkSavedEvent.detailType,
		detail: JSON.stringify({ url: params.url, userId: params.userId }),
	});
};

const processContent = initProcessContentWithLocalMedia({
	rewriteHtmlUrls: (html, rewriteUrl) => {
		const plugin = urls({ eachURL: rewriteUrl });
		return posthtml().use(plugin).process(html).then(result => result.html);
	},
});

const { logParseError } = initLogParseError({
	logger: HutchLogger.fromJSON<ParseErrorEvent>(),
	now: () => new Date(),
	source: "save-link",
});

const { logCrawlOutcome } = initLogCrawlOutcome({
	logger: HutchLogger.fromJSON<CrawlOutcomeEvent>(),
	now: () => new Date(),
});

const { checkTier0SourceExists } = initCheckTier0SourceExistsS3({
	client: s3Client,
	bucketName: contentBucketName,
});

const { readArticleCrawlState } = initReadArticleCrawlStateDynamoDb({
	client,
	tableName: articlesTable,
});

const { readTierSnapshot } = initReadTierSnapshot({
	checkTier0SourceExists,
	readArticleCrawlState,
});

export const handler = initSaveLinkCommandHandler({
	crawlArticle,
	parseHtml,
	putObject,
	putImageObject,
	updateContentLocation,
	updateFetchTimestamp,
	updateArticleMetadata,
	markCrawlReady,
	markCrawlFailed,
	markCrawlStage,
	publishLinkSaved,
	publishEvent,
	downloadMedia,
	processContent,
	updateThumbnailUrl,
	imagesCdnBaseUrl,
	now: () => new Date(),
	logger: consoleLogger,
	logParseError,
	logCrawlOutcome,
	readTierSnapshot,
});
