import * as pulumi from "@pulumi/pulumi";
import {
	HutchEventBus,
	HutchLambda,
	HutchDynamoDBAccess,
	HutchDLQEventHandler,
	HutchSQS,
	HutchSQSBackedLambda,
	HutchS3ReadWrite,
	HutchS3ContentMediaCDN,
} from "@packages/hutch-infra-components/infra";
import {
	SaveLinkCommand,
	SaveAnonymousLinkCommand,
	SaveLinkRawHtmlCommand,
	LinkSavedEvent,
	AnonymousLinkSavedEvent,
	SummaryGeneratedEvent,
	SummaryGenerationFailedEvent,
	RefreshArticleContentCommand,
	UpdateFetchTimestampCommand,
} from "@packages/hutch-infra-components";
import { requireEnv } from "../require-env";

const config = new pulumi.Config();
const alertEmail = config.require("alertEmail");
const articlesTableName = config.require("articlesTableName");
const articlesTableArn = config.require("articlesTableArn");
const contentBucketName = config.require("contentBucketName");
const pendingHtmlBucketName = config.require("pendingHtmlBucketName");

// --- Content S3 Bucket ---

const contentBucket = new HutchS3ReadWrite("content-bucket", {
	bucketName: contentBucketName,
});

// --- Pending-HTML S3 Bucket ---
// Holds extension-captured raw HTML between the web Lambda's PutObject and the
// save-link-raw-html worker's GetObject. Separate from content-bucket so we can
// add an aggressive lifecycle rule later (pending-html is staging, not canonical).

const pendingHtmlBucket = new HutchS3ReadWrite("pending-html-bucket", {
	bucketName: pendingHtmlBucketName,
});

// --- Content Images CDN ---

const contentMediaCdn = new HutchS3ContentMediaCDN("content-media", {
	contentBucket,
});

const deepseekApiKey = pulumi.secret(requireEnv("DEEPSEEK_API_KEY"));

const eventBus = HutchEventBus.fromPlatformStack(config);

// --- Queues ---

const generateSummaryQueue = new HutchSQS("generate-summary", {
	visibilityTimeoutSeconds: 300,
});

const linkSavedQueue = new HutchSQS("link-saved", {
	visibilityTimeoutSeconds: 60,
});

const saveLinkCommandQueue = new HutchSQS("save-link-command", {
	visibilityTimeoutSeconds: 60,
});

const saveAnonymousLinkCommandQueue = new HutchSQS("save-anonymous-link-command", {
	visibilityTimeoutSeconds: 60,
});

const saveLinkRawHtmlCommandQueue = new HutchSQS("save-link-raw-html-command", {
	visibilityTimeoutSeconds: 60,
});

const anonymousLinkSavedQueue = new HutchSQS("anonymous-link-saved", {
	visibilityTimeoutSeconds: 60,
});

const summaryGeneratedQueue = new HutchSQS("summary-generated", {
	visibilityTimeoutSeconds: 60,
});

const summaryGenerationFailedQueue = new HutchSQS("summary-generation-failed", {
	visibilityTimeoutSeconds: 60,
});

// --- SaveLinkCommand handler ---

const saveLinkCommandDynamodb = new HutchDynamoDBAccess("save-link-command-dynamodb", {
	tables: [{ arn: articlesTableArn, includeIndexes: false }],
	actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
});

const saveLinkCommandLambda = new HutchLambda("save-link-command", {
	entryPoint: "./src/runtime/save-link-command.main.ts",
	outputDir: ".lib/save-link-command",
	assetDir: "./src",
	memorySize: 256,
	timeout: 30,
	environment: {
		DYNAMODB_ARTICLES_TABLE: articlesTableName,
		CONTENT_BUCKET_NAME: contentBucketName,
		EVENT_BUS_NAME: eventBus.eventBusName,
		IMAGES_CDN_BASE_URL: contentMediaCdn.baseUrl,
	},
	policies: [
		...saveLinkCommandDynamodb.policies,
		...contentBucket.writePolicies("save-link-command-s3"),
	],
});

eventBus.grantPublish(saveLinkCommandLambda);

const saveLinkCommandLambdaWithSQS = new HutchSQSBackedLambda("save-link-command", {
	lambda: saveLinkCommandLambda,
	queue: saveLinkCommandQueue,
	alertEmailDLQEntry: alertEmail,
});

eventBus.subscribe(SaveLinkCommand, saveLinkCommandLambdaWithSQS);

// --- SaveLinkCommand DLQ consumer ---
// Flips crawlStatus to "failed" and publishes CrawlArticleFailedEvent when a
// SaveLinkCommand message exhausts maxReceiveCount. The HutchSQSBackedLambda
// above already wires the DLQ-arrival CloudWatch alarm + admin email.
new HutchDLQEventHandler("save-link-dlq", {
	sourceQueue: saveLinkCommandQueue,
	tableArn: articlesTableArn,
	tableName: articlesTableName,
	eventBus,
});

// --- SaveLinkRawHtmlCommand handler ---

const saveLinkRawHtmlCommandDynamodb = new HutchDynamoDBAccess("save-link-raw-html-command-dynamodb", {
	tables: [{ arn: articlesTableArn, includeIndexes: false }],
	actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
});

const saveLinkRawHtmlCommandLambda = new HutchLambda("save-link-raw-html-command", {
	entryPoint: "./src/runtime/save-link-raw-html-command.main.ts",
	outputDir: ".lib/save-link-raw-html-command",
	assetDir: "./src",
	memorySize: 256,
	timeout: 30,
	environment: {
		DYNAMODB_ARTICLES_TABLE: articlesTableName,
		CONTENT_BUCKET_NAME: contentBucketName,
		PENDING_HTML_BUCKET_NAME: pendingHtmlBucketName,
		EVENT_BUS_NAME: eventBus.eventBusName,
		IMAGES_CDN_BASE_URL: contentMediaCdn.baseUrl,
	},
	policies: [
		...saveLinkRawHtmlCommandDynamodb.policies,
		...pendingHtmlBucket.readPolicies("save-link-raw-html-command-pending-html"),
		...contentBucket.writePolicies("save-link-raw-html-command-s3"),
	],
});

eventBus.grantPublish(saveLinkRawHtmlCommandLambda);

const saveLinkRawHtmlCommandLambdaWithSQS = new HutchSQSBackedLambda("save-link-raw-html-command", {
	lambda: saveLinkRawHtmlCommandLambda,
	queue: saveLinkRawHtmlCommandQueue,
	alertEmailDLQEntry: alertEmail,
});

eventBus.subscribe(SaveLinkRawHtmlCommand, saveLinkRawHtmlCommandLambdaWithSQS);

// --- SaveAnonymousLinkCommand handler ---

const saveAnonymousLinkCommandDynamodb = new HutchDynamoDBAccess("save-anonymous-link-command-dynamodb", {
	tables: [{ arn: articlesTableArn, includeIndexes: false }],
	actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
});

const saveAnonymousLinkCommandLambda = new HutchLambda("save-anonymous-link-command", {
	entryPoint: "./src/runtime/save-anonymous-link-command.main.ts",
	outputDir: ".lib/save-anonymous-link-command",
	assetDir: "./src",
	memorySize: 256,
	timeout: 30,
	environment: {
		DYNAMODB_ARTICLES_TABLE: articlesTableName,
		CONTENT_BUCKET_NAME: contentBucketName,
		EVENT_BUS_NAME: eventBus.eventBusName,
		IMAGES_CDN_BASE_URL: contentMediaCdn.baseUrl,
	},
	policies: [
		...saveAnonymousLinkCommandDynamodb.policies,
		...contentBucket.writePolicies("save-anonymous-link-command-s3"),
	],
});

eventBus.grantPublish(saveAnonymousLinkCommandLambda);

const saveAnonymousLinkCommandLambdaWithSQS = new HutchSQSBackedLambda("save-anonymous-link-command", {
	lambda: saveAnonymousLinkCommandLambda,
	queue: saveAnonymousLinkCommandQueue,
	alertEmailDLQEntry: alertEmail,
});

eventBus.subscribe(SaveAnonymousLinkCommand, saveAnonymousLinkCommandLambdaWithSQS);

// --- SaveAnonymousLinkCommand DLQ consumer ---
new HutchDLQEventHandler("save-anonymous-link-dlq", {
	sourceQueue: saveAnonymousLinkCommandQueue,
	tableArn: articlesTableArn,
	tableName: articlesTableName,
	eventBus,
});

// --- GenerateSummary handler ---

const generateSummaryDynamodb = new HutchDynamoDBAccess("generate-summary-dynamodb", {
	tables: [{ arn: articlesTableArn, includeIndexes: false }],
	actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
});

const generateSummaryLambda = new HutchLambda("generate-summary", {
	entryPoint: "./src/runtime/generate-summary.main.ts",
	outputDir: ".lib/generate-summary",
	assetDir: "./src",
	memorySize: 512,
	timeout: 45,
	environment: {
		DYNAMODB_ARTICLES_TABLE: articlesTableName,
		DEEPSEEK_API_KEY: deepseekApiKey,
		EVENT_BUS_NAME: eventBus.eventBusName,
		CONTENT_BUCKET_NAME: contentBucketName,
	},
	policies: [
		...generateSummaryDynamodb.policies,
		...contentBucket.readPolicies("generate-summary-s3"),
	],
});

eventBus.grantPublish(generateSummaryLambda);

new HutchSQSBackedLambda("generate-summary", {
	lambda: generateSummaryLambda,
	queue: generateSummaryQueue,
	alertEmailDLQEntry: alertEmail,
});

// --- GenerateSummary DLQ consumer ---
// Flips the summaryStatus row to "failed" and publishes SummaryGenerationFailedEvent
// when a message lands in generate-summary-dlq. The entry point is derived from the
// component name, i.e. ./src/runtime/generate-summary-dlq.main.ts.
new HutchDLQEventHandler("generate-summary-dlq", {
	sourceQueue: generateSummaryQueue,
	tableArn: articlesTableArn,
	tableName: articlesTableName,
	eventBus,
});

// --- LinkSaved handler ---

const linkSavedDynamodb = new HutchDynamoDBAccess("link-saved-dynamodb", {
	tables: [{ arn: articlesTableArn, includeIndexes: false }],
	actions: ["dynamodb:GetItem"],
});

const linkSavedLambda = new HutchLambda("link-saved", {
	entryPoint: "./src/runtime/link-saved.main.ts",
	outputDir: ".lib/link-saved",
	assetDir: "./src",
	memorySize: 256,
	timeout: 30,
	environment: {
		DYNAMODB_ARTICLES_TABLE: articlesTableName,
		GENERATE_SUMMARY_QUEUE_URL: generateSummaryQueue.queueUrl,
		CONTENT_BUCKET_NAME: contentBucketName,
	},
	policies: [
		...linkSavedDynamodb.policies,
		...generateSummaryQueue.policies,
		...contentBucket.readPolicies("link-saved-s3"),
	],
});

const linkSavedLambdaWithSQS = new HutchSQSBackedLambda("link-saved", {
	lambda: linkSavedLambda,
	queue: linkSavedQueue,
	alertEmailDLQEntry: alertEmail,
});

eventBus.subscribe(LinkSavedEvent, linkSavedLambdaWithSQS);

// --- AnonymousLinkSaved handler ---

const anonymousLinkSavedDynamodb = new HutchDynamoDBAccess("anonymous-link-saved-dynamodb", {
	tables: [{ arn: articlesTableArn, includeIndexes: false }],
	actions: ["dynamodb:GetItem"],
});

const anonymousLinkSavedLambda = new HutchLambda("anonymous-link-saved", {
	entryPoint: "./src/runtime/anonymous-link-saved.main.ts",
	outputDir: ".lib/anonymous-link-saved",
	assetDir: "./src",
	memorySize: 256,
	timeout: 30,
	environment: {
		DYNAMODB_ARTICLES_TABLE: articlesTableName,
		GENERATE_SUMMARY_QUEUE_URL: generateSummaryQueue.queueUrl,
		CONTENT_BUCKET_NAME: contentBucketName,
	},
	policies: [
		...anonymousLinkSavedDynamodb.policies,
		// Rename the shared queue's send-policy so the Pulumi URN doesn't
		// collide with the link-saved Lambda's attachment of the same policy.
		...generateSummaryQueue.policies.map((p) => ({ ...p, name: `anonymous-${p.name}` })),
		...contentBucket.readPolicies("anonymous-link-saved-s3"),
	],
});

const anonymousLinkSavedLambdaWithSQS = new HutchSQSBackedLambda("anonymous-link-saved", {
	lambda: anonymousLinkSavedLambda,
	queue: anonymousLinkSavedQueue,
	alertEmailDLQEntry: alertEmail,
});

eventBus.subscribe(AnonymousLinkSavedEvent, anonymousLinkSavedLambdaWithSQS);

// --- SummaryGenerated handler ---

const summaryGeneratedLambda = new HutchLambda("summary-generated", {
	entryPoint: "./src/runtime/summary-generated.main.ts",
	outputDir: ".lib/summary-generated",
	assetDir: "./src",
	memorySize: 128,
	timeout: 10,
	environment: {},
	policies: [],
});

const summaryGeneratedLambdaWithSQS = new HutchSQSBackedLambda("summary-generated", {
	lambda: summaryGeneratedLambda,
	queue: summaryGeneratedQueue,
	alertEmailDLQEntry: alertEmail,
});

eventBus.subscribe(SummaryGeneratedEvent, summaryGeneratedLambdaWithSQS);

// --- SummaryGenerationFailed handler ---

const summaryGenerationFailedLambda = new HutchLambda("summary-generation-failed", {
	entryPoint: "./src/runtime/summary-generation-failed.main.ts",
	outputDir: ".lib/summary-generation-failed",
	assetDir: "./src",
	memorySize: 128,
	timeout: 10,
	environment: {},
	policies: [],
});

const summaryGenerationFailedLambdaWithSQS = new HutchSQSBackedLambda("summary-generation-failed", {
	lambda: summaryGenerationFailedLambda,
	queue: summaryGenerationFailedQueue,
	alertEmailDLQEntry: alertEmail,
});

eventBus.subscribe(SummaryGenerationFailedEvent, summaryGenerationFailedLambdaWithSQS);

// --- RefreshArticleContent handler ---

const refreshArticleContentQueue = new HutchSQS("refresh-article-content", {
	visibilityTimeoutSeconds: 60,
});

const refreshArticleContentDynamodb = new HutchDynamoDBAccess("refresh-article-content-dynamodb", {
	tables: [{ arn: articlesTableArn, includeIndexes: false }],
	actions: ["dynamodb:UpdateItem"],
});

const refreshArticleContentLambda = new HutchLambda("refresh-article-content", {
	entryPoint: "./src/runtime/refresh-article-content.main.ts",
	outputDir: ".lib/refresh-article-content",
	assetDir: "./src",
	memorySize: 256,
	timeout: 30,
	environment: {
		DYNAMODB_ARTICLES_TABLE: articlesTableName,
	},
	policies: [
		...refreshArticleContentDynamodb.policies,
	],
});

const refreshArticleContentWithSQS = new HutchSQSBackedLambda("refresh-article-content", {
	lambda: refreshArticleContentLambda,
	queue: refreshArticleContentQueue,
	alertEmailDLQEntry: alertEmail,
});

eventBus.subscribe(RefreshArticleContentCommand, refreshArticleContentWithSQS);

// --- UpdateFetchTimestamp handler ---

const updateFetchTimestampQueue = new HutchSQS("update-fetch-timestamp", {
	visibilityTimeoutSeconds: 60,
});

const updateFetchTimestampDynamodb = new HutchDynamoDBAccess("update-fetch-timestamp-dynamodb", {
	tables: [{ arn: articlesTableArn, includeIndexes: false }],
	actions: ["dynamodb:UpdateItem"],
});

const updateFetchTimestampLambda = new HutchLambda("update-fetch-timestamp", {
	entryPoint: "./src/runtime/update-fetch-timestamp.main.ts",
	outputDir: ".lib/update-fetch-timestamp",
	assetDir: "./src",
	memorySize: 128,
	timeout: 10,
	environment: {
		DYNAMODB_ARTICLES_TABLE: articlesTableName,
	},
	policies: [
		...updateFetchTimestampDynamodb.policies,
	],
});

const updateFetchTimestampWithSQS = new HutchSQSBackedLambda("update-fetch-timestamp", {
	lambda: updateFetchTimestampLambda,
	queue: updateFetchTimestampQueue,
	alertEmailDLQEntry: alertEmail,
});

eventBus.subscribe(UpdateFetchTimestampCommand, updateFetchTimestampWithSQS);

// --- Exports ---

export const saveLinkCommandQueueUrl = saveLinkCommandQueue.queueUrl;
export const saveLinkCommandDlqUrl = saveLinkCommandQueue.dlqUrl;
export const saveAnonymousLinkCommandQueueUrl = saveAnonymousLinkCommandQueue.queueUrl;
export const saveAnonymousLinkCommandDlqUrl = saveAnonymousLinkCommandQueue.dlqUrl;
export const saveLinkRawHtmlCommandQueueUrl = saveLinkRawHtmlCommandQueue.queueUrl;
export const saveLinkRawHtmlCommandDlqUrl = saveLinkRawHtmlCommandQueue.dlqUrl;
export const linkSavedQueueUrl = linkSavedQueue.queueUrl;
export const linkSavedDlqUrl = linkSavedQueue.dlqUrl;
export const anonymousLinkSavedQueueUrl = anonymousLinkSavedQueue.queueUrl;
export const anonymousLinkSavedDlqUrl = anonymousLinkSavedQueue.dlqUrl;
export const generateSummaryQueueUrl = generateSummaryQueue.queueUrl;
export const generateSummaryDlqUrl = generateSummaryQueue.dlqUrl;
export const summaryGeneratedQueueUrl = summaryGeneratedQueue.queueUrl;
export const summaryGeneratedDlqUrl = summaryGeneratedQueue.dlqUrl;
export const summaryGenerationFailedQueueUrl = summaryGenerationFailedQueue.queueUrl;
export const summaryGenerationFailedDlqUrl = summaryGenerationFailedQueue.dlqUrl;
export const refreshArticleContentQueueUrl = refreshArticleContentQueue.queueUrl;
export const refreshArticleContentDlqUrl = refreshArticleContentQueue.dlqUrl;
export const updateFetchTimestampQueueUrl = updateFetchTimestampQueue.queueUrl;
export const updateFetchTimestampDlqUrl = updateFetchTimestampQueue.dlqUrl;
export const contentBucketOutputName = contentBucket.bucket;
export const contentBucketOutputArn = contentBucket.arn;
