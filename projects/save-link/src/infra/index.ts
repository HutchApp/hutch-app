import * as pulumi from "@pulumi/pulumi";
import {
	HutchEventRule,
	HutchLambda,
	HutchDynamoDBAccess,
	HutchEventBridgePublishAccess,
	HutchSqsSendAccess,
	HutchDlqAlarm,
	SQSBackedLambda,
} from "@packages/hutch-infra-components/infra";
import {
	LINK_SAVED_SOURCE,
	LINK_SAVED_DETAIL_TYPE,
	GLOBAL_SUMMARY_GENERATED_SOURCE,
	GLOBAL_SUMMARY_GENERATED_DETAIL_TYPE,
} from "@packages/hutch-infra-components";
import { getEnv } from "../require-env";

const config = new pulumi.Config();
const platformStack = config.require("platformStack");
const alertEmail = config.require("alertEmail");
const articlesTableName = config.require("articlesTableName");
const articlesTableArn = config.require("articlesTableArn");

const deepseekApiKeyValue = getEnv("DEEPSEEK_API_KEY");
const deepseekApiKey = deepseekApiKeyValue
	? pulumi.secret(deepseekApiKeyValue)
	: undefined;

const platform = new pulumi.StackReference(platformStack);
const eventBusName = platform.requireOutput("hutchEventBusName").apply(String);
const eventBusArn = platform.requireOutput("hutchEventBusArn").apply(String);

// --- GenerateSummary handler (created first — link-saved needs its queue URL) ---

const generateSummaryDynamodb = new HutchDynamoDBAccess("generate-summary-dynamodb", {
	tables: [{ arn: articlesTableArn, includeIndexes: false }],
	actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
});

const generateSummaryLambda = new HutchLambda("generate-summary", {
	entryPoint: "./src/infra/generate-summary-lambda.ts",
	outputDir: ".lib/generate-summary",
	assetDir: "./src",
	memorySize: 512,
	timeout: 45,
	resourceNames: {
		role: "generate-summary-handler-role",
		basicExecution: "generate-summary-basic-execution",
		lambda: "generate-summary-handler",
	},
	environment: {
		DYNAMODB_ARTICLES_TABLE: articlesTableName,
		...(deepseekApiKey ? { DEEPSEEK_API_KEY: deepseekApiKey } : {}),
		EVENT_BUS_NAME: eventBusName,
	},
	policies: [
		...generateSummaryDynamodb.policies,
		...new HutchEventBridgePublishAccess("generate-summary-eventbridge", { eventBusArn }).policies,
	],
});

const generateSummarySqs = new SQSBackedLambda("generate-summary", {
	lambda: generateSummaryLambda,
	visibilityTimeoutSeconds: 300,
	batchSize: 1,
});

// --- LinkSaved handler ---

const linkSavedDynamodb = new HutchDynamoDBAccess("link-saved-dynamodb", {
	tables: [{ arn: articlesTableArn, includeIndexes: false }],
	actions: ["dynamodb:GetItem"],
});

const linkSavedLambda = new HutchLambda("link-saved", {
	entryPoint: "./src/infra/link-saved-lambda.ts",
	outputDir: ".lib/link-saved",
	assetDir: "./src",
	memorySize: 256,
	timeout: 30,
	resourceNames: {
		role: "link-saved-handler-role",
		basicExecution: "link-saved-basic-execution",
		lambda: "link-saved-handler",
	},
	environment: {
		DYNAMODB_ARTICLES_TABLE: articlesTableName,
		GENERATE_SUMMARY_QUEUE_URL: generateSummarySqs.queueUrl,
	},
	policies: [
		...linkSavedDynamodb.policies,
		...new HutchSqsSendAccess("link-saved-sqs-send", { queueArn: generateSummarySqs.queueArn }).policies,
	],
});

const linkSavedSqs = new SQSBackedLambda("link-saved", {
	lambda: linkSavedLambda,
	visibilityTimeoutSeconds: 60,
	batchSize: 1,
});

new HutchEventRule("link-saved", {
	eventBusName,
	source: LINK_SAVED_SOURCE,
	detailType: LINK_SAVED_DETAIL_TYPE,
	targetQueueArn: linkSavedSqs.queueArn,
	targetQueueUrl: linkSavedSqs.queueUrl,
});

// --- SummaryGenerated handler ---

const summaryGeneratedLambda = new HutchLambda("summary-generated", {
	entryPoint: "./src/infra/summary-generated-lambda.ts",
	outputDir: ".lib/summary-generated",
	assetDir: "./src",
	memorySize: 128,
	timeout: 10,
	resourceNames: {
		role: "summary-generated-handler-role",
		basicExecution: "summary-generated-basic-execution",
		lambda: "summary-generated-handler",
	},
	environment: {},
	policies: [],
});

const summaryGeneratedSqs = new SQSBackedLambda("summary-generated", {
	lambda: summaryGeneratedLambda,
	visibilityTimeoutSeconds: 60,
	batchSize: 1,
});

new HutchEventRule("summary-generated", {
	eventBusName,
	source: GLOBAL_SUMMARY_GENERATED_SOURCE,
	detailType: GLOBAL_SUMMARY_GENERATED_DETAIL_TYPE,
	targetQueueArn: summaryGeneratedSqs.queueArn,
	targetQueueUrl: summaryGeneratedSqs.queueUrl,
});

// --- DLQ Alarms ---

new HutchDlqAlarm("save-link", {
	queues: [
		{ name: "link-saved", dlqName: linkSavedSqs.dlqName },
		{ name: "generate-summary", dlqName: generateSummarySqs.dlqName },
		{ name: "summary-generated", dlqName: summaryGeneratedSqs.dlqName },
	],
	alertEmail,
});

// --- Exports ---

export const linkSavedQueueUrl = linkSavedSqs.queueUrl;
export const linkSavedDlqUrl = linkSavedSqs.dlqUrl;
export const generateSummaryQueueUrl = generateSummarySqs.queueUrl;
export const generateSummaryDlqUrl = generateSummarySqs.dlqUrl;
export const summaryGeneratedQueueUrl = summaryGeneratedSqs.queueUrl;
export const summaryGeneratedDlqUrl = summaryGeneratedSqs.dlqUrl;
