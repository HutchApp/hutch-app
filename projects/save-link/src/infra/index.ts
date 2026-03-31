import * as pulumi from "@pulumi/pulumi";
import {
	HutchEventRule,
	HutchLambda,
	HutchDynamoDBAccess,
	SQSBackedLambda,
} from "@packages/hutch-event-bridge/infra";
import {
	LINK_SAVED_SOURCE,
	LINK_SAVED_DETAIL_TYPE,
} from "../save-link/index";
import {
	GLOBAL_SUMMARY_GENERATED_SOURCE,
	GLOBAL_SUMMARY_GENERATED_DETAIL_TYPE,
} from "../generate-summary/index";

const config = new pulumi.Config();
const platformStack = config.require("platformStack");
const articlesTableName = config.require("articlesTableName");
const articlesTableArn = config.require("articlesTableArn");

const anthropicApiKey = process.env.ANTHROPIC_API_KEY
	? pulumi.secret(process.env.ANTHROPIC_API_KEY)
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
		...(anthropicApiKey ? { ANTHROPIC_API_KEY: anthropicApiKey } : {}),
		EVENT_BUS_NAME: eventBusName,
	},
	policies: [
		...generateSummaryDynamodb.policies,
		{
			name: "generate-summary-eventbridge",
			policy: eventBusArn.apply((arn) =>
				JSON.stringify({
					Version: "2012-10-17",
					Statement: [{
						Effect: "Allow",
						Action: ["events:PutEvents"],
						Resource: [arn],
					}],
				}),
			),
		},
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
		{
			name: "link-saved-sqs-send",
			policy: generateSummarySqs.queueArn.apply((arn) =>
				JSON.stringify({
					Version: "2012-10-17",
					Statement: [{
						Effect: "Allow",
						Action: ["sqs:SendMessage"],
						Resource: [arn],
					}],
				}),
			),
		},
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

export const linkSavedQueueUrl = linkSavedSqs.queueUrl;
export const linkSavedDlqUrl = linkSavedSqs.dlqUrl;
export const generateSummaryQueueUrl = generateSummarySqs.queueUrl;
export const generateSummaryDlqUrl = generateSummarySqs.dlqUrl;
export const summaryGeneratedQueueUrl = summaryGeneratedSqs.queueUrl;
export const summaryGeneratedDlqUrl = summaryGeneratedSqs.dlqUrl;
