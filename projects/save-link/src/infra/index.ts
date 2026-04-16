import * as pulumi from "@pulumi/pulumi";
import {
	HutchEventBus,
	HutchLambda,
	HutchDynamoDBAccess,
	HutchSQS,
	HutchSQSBackedLambda,
	HutchS3ReadWrite,
	HutchS3ContentMediaCDN,
} from "@packages/hutch-infra-components/infra";
import {
	SaveLinkCommand,
	LinkSavedEvent,
	SummaryGeneratedEvent,
	RefreshArticleContentCommand,
	UpdateFetchTimestampCommand,
} from "@packages/hutch-infra-components";
import { requireEnv } from "../require-env";

const config = new pulumi.Config();
const alertEmail = config.require("alertEmail");
const articlesTableName = config.require("articlesTableName");
const articlesTableArn = config.require("articlesTableArn");
const contentBucketName = config.require("contentBucketName");

// --- Content S3 Bucket ---

const contentBucket = new HutchS3ReadWrite("content-bucket", {
	bucketName: contentBucketName,
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

const summaryGeneratedQueue = new HutchSQS("summary-generated", {
	visibilityTimeoutSeconds: 60,
});

// --- SaveLinkCommand handler ---

const saveLinkCommandDynamodb = new HutchDynamoDBAccess("save-link-command-dynamodb", {
	tables: [{ arn: articlesTableArn, includeIndexes: false }],
	actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
});

const saveLinkCommandLambda = new HutchLambda("save-link-command", {
	entryPoint: "./src/infra/save-link-command.main.ts",
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

// --- GenerateSummary handler ---

const generateSummaryDynamodb = new HutchDynamoDBAccess("generate-summary-dynamodb", {
	tables: [{ arn: articlesTableArn, includeIndexes: false }],
	actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
});

const generateSummaryLambda = new HutchLambda("generate-summary", {
	entryPoint: "./src/infra/generate-summary.main.ts",
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

// --- LinkSaved handler ---

const linkSavedDynamodb = new HutchDynamoDBAccess("link-saved-dynamodb", {
	tables: [{ arn: articlesTableArn, includeIndexes: false }],
	actions: ["dynamodb:GetItem"],
});

const linkSavedLambda = new HutchLambda("link-saved", {
	entryPoint: "./src/infra/link-saved.main.ts",
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

// --- SummaryGenerated handler ---

const summaryGeneratedLambda = new HutchLambda("summary-generated", {
	entryPoint: "./src/infra/summary-generated.main.ts",
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

// --- RefreshArticleContent handler ---

const refreshArticleContentQueue = new HutchSQS("refresh-article-content", {
	visibilityTimeoutSeconds: 60,
});

const refreshArticleContentDynamodb = new HutchDynamoDBAccess("refresh-article-content-dynamodb", {
	tables: [{ arn: articlesTableArn, includeIndexes: false }],
	actions: ["dynamodb:UpdateItem"],
});

const refreshArticleContentLambda = new HutchLambda("refresh-article-content", {
	entryPoint: "./src/infra/refresh-article-content.main.ts",
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
	entryPoint: "./src/infra/update-fetch-timestamp.main.ts",
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
export const linkSavedQueueUrl = linkSavedQueue.queueUrl;
export const linkSavedDlqUrl = linkSavedQueue.dlqUrl;
export const generateSummaryQueueUrl = generateSummaryQueue.queueUrl;
export const generateSummaryDlqUrl = generateSummaryQueue.dlqUrl;
export const summaryGeneratedQueueUrl = summaryGeneratedQueue.queueUrl;
export const summaryGeneratedDlqUrl = summaryGeneratedQueue.dlqUrl;
export const refreshArticleContentQueueUrl = refreshArticleContentQueue.queueUrl;
export const refreshArticleContentDlqUrl = refreshArticleContentQueue.dlqUrl;
export const updateFetchTimestampQueueUrl = updateFetchTimestampQueue.queueUrl;
export const updateFetchTimestampDlqUrl = updateFetchTimestampQueue.dlqUrl;
export const contentBucketOutputName = contentBucket.bucket;
export const contentBucketOutputArn = contentBucket.arn;
