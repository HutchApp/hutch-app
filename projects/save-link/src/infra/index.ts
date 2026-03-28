import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { build, type Loader } from "esbuild";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { HutchEventRule, HutchSqsQueue } from "@packages/hutch-event-bridge/infra";
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
const summarizerMaxConcurrency = config.requireNumber("summarizerMaxConcurrency");
const anthropicApiKey = config.requireSecret("anthropicApiKey");

const platform = new pulumi.StackReference(platformStack);
const eventBusName = platform.requireOutput("hutchEventBusName").apply(String);
const eventBusArn = platform.requireOutput("hutchEventBusArn").apply(String);

const esbuildLoaders: Record<string, Loader> = { ".ts": "ts" };
const bundledExtensions = Object.keys(esbuildLoaders);

function copyAssetFiles(dirs: { src: string; dest: string }) {
	for (const entry of readdirSync(dirs.src, { withFileTypes: true })) {
		const srcPath = join(dirs.src, entry.name);
		if (entry.isDirectory()) {
			copyAssetFiles({ src: srcPath, dest: dirs.dest });
		} else if (!bundledExtensions.some((ext) => entry.name.endsWith(ext))) {
			copyFileSync(srcPath, join(dirs.dest, entry.name));
		}
	}
}

function buildLambda(entryPoint: string, outputDir: string) {
	return build({
		entryPoints: [entryPoint],
		bundle: true,
		sourcemap: true,
		platform: "node",
		format: "cjs",
		minify: true,
		outfile: `${outputDir}/index.js`,
		target: ["node22"],
		loader: esbuildLoaders,
	}).then(() => {
		mkdirSync(outputDir, { recursive: true });
		copyAssetFiles({ src: "./src", dest: outputDir });
		return new pulumi.asset.AssetArchive({
			".": new pulumi.asset.FileArchive(outputDir),
		});
	});
}

// --- LinkSaved handler ---

const linkSavedQueue = new HutchSqsQueue("link-saved", {
	visibilityTimeoutSeconds: 60,
});

new HutchEventRule("link-saved", {
	eventBusName,
	source: LINK_SAVED_SOURCE,
	detailType: LINK_SAVED_DETAIL_TYPE,
	targetQueueArn: linkSavedQueue.queueArn,
	targetQueueUrl: linkSavedQueue.queueUrl,
});

const linkSavedRole = new aws.iam.Role("link-saved-handler-role", {
	assumeRolePolicy: JSON.stringify({
		Version: "2012-10-17",
		Statement: [{ Action: "sts:AssumeRole", Principal: { Service: "lambda.amazonaws.com" }, Effect: "Allow" }],
	}),
});

new aws.iam.RolePolicyAttachment("link-saved-basic-execution", {
	role: linkSavedRole.name,
	policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
});

new aws.iam.RolePolicy("link-saved-dynamodb", {
	role: linkSavedRole.name,
	policy: JSON.stringify({
		Version: "2012-10-17",
		Statement: [{
			Effect: "Allow",
			Action: ["dynamodb:GetItem"],
			Resource: [articlesTableArn],
		}],
	}),
});

const generateSummaryQueue = new HutchSqsQueue("generate-summary", {
	visibilityTimeoutSeconds: 300,
});

new aws.iam.RolePolicy("link-saved-sqs-send", {
	role: linkSavedRole.name,
	policy: generateSummaryQueue.queueArn.apply((arn) =>
		JSON.stringify({
			Version: "2012-10-17",
			Statement: [{
				Effect: "Allow",
				Action: ["sqs:SendMessage"],
				Resource: [arn],
			}],
		}),
	),
});

new aws.iam.RolePolicy("link-saved-sqs-receive", {
	role: linkSavedRole.name,
	policy: linkSavedQueue.queueArn.apply((arn) =>
		JSON.stringify({
			Version: "2012-10-17",
			Statement: [{
				Effect: "Allow",
				Action: ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
				Resource: [arn],
			}],
		}),
	),
});

const linkSavedLambda = new aws.lambda.Function("link-saved-handler", {
	runtime: aws.lambda.Runtime.NodeJS22dX,
	handler: "index.handler",
	role: linkSavedRole.arn,
	code: buildLambda("./src/infra/link-saved-lambda.ts", ".lib/link-saved"),
	memorySize: 256,
	timeout: 30,
	environment: {
		variables: {
			DYNAMODB_ARTICLES_TABLE: articlesTableName,
			GENERATE_SUMMARY_QUEUE_URL: generateSummaryQueue.queueUrl,
		},
	},
});

new aws.lambda.EventSourceMapping("link-saved-sqs-mapping", {
	eventSourceArn: linkSavedQueue.queueArn,
	functionName: linkSavedLambda.arn,
	batchSize: 1,
});

// --- GenerateGlobalSummary handler ---

const generateSummaryRole = new aws.iam.Role("generate-summary-handler-role", {
	assumeRolePolicy: JSON.stringify({
		Version: "2012-10-17",
		Statement: [{ Action: "sts:AssumeRole", Principal: { Service: "lambda.amazonaws.com" }, Effect: "Allow" }],
	}),
});

new aws.iam.RolePolicyAttachment("generate-summary-basic-execution", {
	role: generateSummaryRole.name,
	policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
});

new aws.iam.RolePolicy("generate-summary-dynamodb", {
	role: generateSummaryRole.name,
	policy: JSON.stringify({
		Version: "2012-10-17",
		Statement: [{
			Effect: "Allow",
			Action: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
			Resource: [articlesTableArn],
		}],
	}),
});

new aws.iam.RolePolicy("generate-summary-sqs-receive", {
	role: generateSummaryRole.name,
	policy: generateSummaryQueue.queueArn.apply((arn) =>
		JSON.stringify({
			Version: "2012-10-17",
			Statement: [{
				Effect: "Allow",
				Action: ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
				Resource: [arn],
			}],
		}),
	),
});

new aws.iam.RolePolicy("generate-summary-eventbridge", {
	role: generateSummaryRole.name,
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
});

const generateSummaryLambda = new aws.lambda.Function("generate-summary-handler", {
	runtime: aws.lambda.Runtime.NodeJS22dX,
	handler: "index.handler",
	role: generateSummaryRole.arn,
	code: buildLambda("./src/infra/generate-summary-lambda.ts", ".lib/generate-summary"),
	memorySize: 512,
	timeout: 45,
	reservedConcurrentExecutions: summarizerMaxConcurrency,
	environment: {
		variables: {
			DYNAMODB_ARTICLES_TABLE: articlesTableName,
			ANTHROPIC_API_KEY: anthropicApiKey,
			EVENT_BUS_NAME: eventBusName,
		},
	},
});

new aws.lambda.EventSourceMapping("generate-summary-sqs-mapping", {
	eventSourceArn: generateSummaryQueue.queueArn,
	functionName: generateSummaryLambda.arn,
	batchSize: 1,
});

// --- GlobalSummaryGenerated handler ---

const summaryGeneratedQueue = new HutchSqsQueue("summary-generated", {
	visibilityTimeoutSeconds: 60,
});

new HutchEventRule("summary-generated", {
	eventBusName,
	source: GLOBAL_SUMMARY_GENERATED_SOURCE,
	detailType: GLOBAL_SUMMARY_GENERATED_DETAIL_TYPE,
	targetQueueArn: summaryGeneratedQueue.queueArn,
	targetQueueUrl: summaryGeneratedQueue.queueUrl,
});

const summaryGeneratedRole = new aws.iam.Role("summary-generated-handler-role", {
	assumeRolePolicy: JSON.stringify({
		Version: "2012-10-17",
		Statement: [{ Action: "sts:AssumeRole", Principal: { Service: "lambda.amazonaws.com" }, Effect: "Allow" }],
	}),
});

new aws.iam.RolePolicyAttachment("summary-generated-basic-execution", {
	role: summaryGeneratedRole.name,
	policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
});

new aws.iam.RolePolicy("summary-generated-sqs-receive", {
	role: summaryGeneratedRole.name,
	policy: summaryGeneratedQueue.queueArn.apply((arn) =>
		JSON.stringify({
			Version: "2012-10-17",
			Statement: [{
				Effect: "Allow",
				Action: ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
				Resource: [arn],
			}],
		}),
	),
});

const summaryGeneratedLambda = new aws.lambda.Function("summary-generated-handler", {
	runtime: aws.lambda.Runtime.NodeJS22dX,
	handler: "index.handler",
	role: summaryGeneratedRole.arn,
	code: buildLambda("./src/infra/summary-generated-lambda.ts", ".lib/summary-generated"),
	memorySize: 128,
	timeout: 10,
});

new aws.lambda.EventSourceMapping("summary-generated-sqs-mapping", {
	eventSourceArn: summaryGeneratedQueue.queueArn,
	functionName: summaryGeneratedLambda.arn,
	batchSize: 1,
});

export const linkSavedQueueUrl = linkSavedQueue.queueUrl;
export const linkSavedDlqUrl = linkSavedQueue.dlqUrl;
export const generateSummaryQueueUrl = generateSummaryQueue.queueUrl;
export const generateSummaryDlqUrl = generateSummaryQueue.dlqUrl;
export const summaryGeneratedQueueUrl = summaryGeneratedQueue.queueUrl;
export const summaryGeneratedDlqUrl = summaryGeneratedQueue.dlqUrl;
