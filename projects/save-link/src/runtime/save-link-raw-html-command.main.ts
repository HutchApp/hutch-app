import { S3Client } from "@aws-sdk/client-s3";
import OpenAI from "openai";
import { HutchLogger, consoleLogger } from "@packages/hutch-logger";
import { DEFAULT_CRAWL_HEADERS, initCrawlArticle } from "@packages/crawl-article";
import { createDynamoDocumentClient } from "@packages/hutch-storage-client";
import { EventBridgeClient, initEventBridgePublisher } from "@packages/hutch-infra-components/runtime";
import { LinkSavedEvent, type ParseErrorEvent, initLogParseError, initLogCrawlOutcome, type CrawlOutcomeEvent } from "@packages/hutch-infra-components";
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
import { initReadCanonicalContent } from "../save-link-raw-html/read-canonical-content";
import { initPromoteSourceToCanonical } from "../save-link-raw-html/promote-source-to-canonical";
import { initSelectMostCompleteContent } from "../save-link-raw-html/select-content";
import { initSaveLinkRawHtmlCommandHandler } from "../save-link-raw-html/save-link-raw-html-command-handler";
import { SELECT_CONTENT_TIMEOUTS } from "../save-link-raw-html/timeouts";
import { initDynamoDbArticleCrawl } from "../crawl-article-state/dynamodb-article-crawl";
import { initCheckTier0SourceExistsS3 } from "../crawl-article-state/check-tier-0-source-exists-s3";
import { initReadArticleCrawlStateDynamoDb } from "../crawl-article-state/read-article-crawl-state-dynamodb";
import { initReadTierSnapshot } from "../crawl-article-state/read-tier-snapshot";

const articlesTable = requireEnv("DYNAMODB_ARTICLES_TABLE");
const contentBucketName = requireEnv("CONTENT_BUCKET_NAME");
const pendingHtmlBucketName = requireEnv("PENDING_HTML_BUCKET_NAME");
const imagesCdnBaseUrl = requireEnv("IMAGES_CDN_BASE_URL");
const eventBusName = requireEnv("EVENT_BUS_NAME");
const deepseekApiKey = requireEnv("DEEPSEEK_API_KEY");

const logError = (message: string, error?: Error) => consoleLogger.error(message, { error });
const s3Client = new S3Client({});
const dynamoClient = createDynamoDocumentClient();
const crawlArticle = initCrawlArticle({ fetch: globalThis.fetch, logError, headers: { ...DEFAULT_CRAWL_HEADERS } });
const deepseekClient = new OpenAI({ apiKey: deepseekApiKey, baseURL: "https://api.deepseek.com", timeout: SELECT_CONTENT_TIMEOUTS.deepseekMs });

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

const { readCanonicalContent } = initReadCanonicalContent({
	dynamoClient,
	s3Client,
	tableName: articlesTable,
	bucketName: contentBucketName,
});

const { promoteSourceToCanonical } = initPromoteSourceToCanonical({
	dynamoClient,
	s3Client,
	tableName: articlesTable,
	bucketName: contentBucketName,
	now: () => new Date(),
});

const { selectMostCompleteContent } = initSelectMostCompleteContent({
	createChatCompletion: (params) => deepseekClient.chat.completions.create(params),
	logger: consoleLogger,
});

const { markCrawlReady, markCrawlFailed } = initDynamoDbArticleCrawl({
	client: dynamoClient,
	tableName: articlesTable,
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

const { logParseError } = initLogParseError({
	logger: HutchLogger.fromJSON<ParseErrorEvent>(),
	now: () => new Date(),
	source: "save-link-raw-html",
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
	client: dynamoClient,
	tableName: articlesTable,
});

const { readTierSnapshot } = initReadTierSnapshot({
	checkTier0SourceExists,
	readArticleCrawlState,
});

export const handler = initSaveLinkRawHtmlCommandHandler({
	readPendingHtml,
	parseHtml,
	downloadMedia,
	processContent,
	putSourceContent,
	readCanonicalContent,
	promoteSourceToCanonical,
	selectMostCompleteContent,
	publishLinkSaved,
	markCrawlReady,
	markCrawlFailed,
	logger: consoleLogger,
	logParseError,
	logCrawlOutcome,
	readTierSnapshot,
});
