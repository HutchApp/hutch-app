import * as pulumi from "@pulumi/pulumi";
import {
	HutchEventBus,
	HutchLambda,
	HutchDynamoDBAccess,
	HutchSQS,
	HutchSQSBackedLambda,
} from "@packages/hutch-infra-components/infra";
import {
	LinkSavedEvent,
	SummaryGeneratedEvent,
} from "@packages/hutch-infra-components";
import { getEnv } from "../require-env";

const config = new pulumi.Config();
const platformStack = config.require("platformStack");
const alertEmail = config.require("alertEmail");
const articlesTableName = config.require("articlesTableName");
const articlesTableArn = config.require("articlesTableArn");

const anthropicApiKeyValue = getEnv("ANTHROPIC_API_KEY");
const anthropicApiKey = anthropicApiKeyValue
	? pulumi.secret(anthropicApiKeyValue)
	: undefined;

const platform = new pulumi.StackReference(platformStack);
const eventBusName = platform.requireOutput("hutchEventBusName").apply(String);
const eventBusArn = platform.requireOutput("hutchEventBusArn").apply(String);

const eventBus = HutchEventBus.fromExisting({ eventBusName, eventBusArn });

// --- Queues ---

const generateSummaryQueue = new HutchSQS("generate-summary", {
	visibilityTimeoutSeconds: 300,
});

const linkSavedQueue = new HutchSQS("link-saved", {
	visibilityTimeoutSeconds: 60,
});

const summaryGeneratedQueue = new HutchSQS("summary-generated", {
	visibilityTimeoutSeconds: 60,
});

// --- GenerateSummary handler ---

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
	],
});

eventBus.grantPublish("generate-summary-eventbridge", generateSummaryLambda);

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
		GENERATE_SUMMARY_QUEUE_URL: generateSummaryQueue.queueUrl,
	},
	policies: [
		...linkSavedDynamodb.policies,
		...generateSummaryQueue.policies,
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

const summaryGeneratedLambdaWithSQS = new HutchSQSBackedLambda("summary-generated", {
	lambda: summaryGeneratedLambda,
	queue: summaryGeneratedQueue,
	alertEmailDLQEntry: alertEmail,
});

eventBus.subscribe(SummaryGeneratedEvent, summaryGeneratedLambdaWithSQS);

// --- Exports ---

export const linkSavedQueueUrl = linkSavedQueue.queueUrl;
export const linkSavedDlqUrl = linkSavedQueue.dlqUrl;
export const generateSummaryQueueUrl = generateSummaryQueue.queueUrl;
export const generateSummaryDlqUrl = generateSummaryQueue.dlqUrl;
export const summaryGeneratedQueueUrl = summaryGeneratedQueue.queueUrl;
export const summaryGeneratedDlqUrl = summaryGeneratedQueue.dlqUrl;
