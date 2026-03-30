import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { build } from "esbuild";
import { HutchEventRule, HutchSqsQueue } from "@packages/hutch-event-bridge/infra";
import { events } from "@packages/hutch-event-bridge";

const config = new pulumi.Config();
const platformStackName = config.require("platformStack");
const platformStack = new pulumi.StackReference(platformStackName);
const eventBusName = platformStack.requireOutput("hutchEventBusName").apply(String);
const eventBusArn = platformStack.requireOutput("hutchEventBusArn").apply(String);

// --- SQS Queues ---

const linkSavedQueue = new HutchSqsQueue("save-link-link-saved", {
	visibilityTimeoutSeconds: 60,
});

const generateSummaryQueue = new HutchSqsQueue("save-link-generate-summary", {
	visibilityTimeoutSeconds: 120,
});

const summaryGeneratedQueue = new HutchSqsQueue("save-link-summary-generated", {
	visibilityTimeoutSeconds: 60,
});

// --- EventBridge Rules ---

new HutchEventRule("save-link-link-saved", {
	eventBusName,
	source: events.LINK_SAVED.source,
	detailType: events.LINK_SAVED.detailType,
	targetQueueArn: linkSavedQueue.queueArn,
	targetQueueUrl: linkSavedQueue.queueUrl,
});

new HutchEventRule("save-link-summary-generated", {
	eventBusName,
	source: events.SUMMARY_GENERATED.source,
	detailType: events.SUMMARY_GENERATED.detailType,
	targetQueueArn: summaryGeneratedQueue.queueArn,
	targetQueueUrl: summaryGeneratedQueue.queueUrl,
});

// --- Lambda shared setup ---

function buildLambda(_name: string, entryPoint: string, outputDir: string) {
	return build({
		entryPoints: [entryPoint],
		bundle: true,
		sourcemap: true,
		platform: "node",
		format: "cjs",
		minify: true,
		outfile: `${outputDir}/index.js`,
		target: ["node22"],
		loader: { ".ts": "ts" },
	}).then(
		() =>
			new pulumi.asset.AssetArchive({
				".": new pulumi.asset.FileArchive(outputDir),
			}),
	);
}

function createLambdaRole(name: string) {
	const role = new aws.iam.Role(`${name}-role`, {
		assumeRolePolicy: JSON.stringify({
			Version: "2012-10-17",
			Statement: [
				{
					Action: "sts:AssumeRole",
					Principal: { Service: "lambda.amazonaws.com" },
					Effect: "Allow",
				},
			],
		}),
	});

	new aws.iam.RolePolicyAttachment(`${name}-basic-execution`, {
		role: role.name,
		policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
	});

	return role;
}

// --- Link Saved Lambda ---

const linkSavedRole = createLambdaRole("save-link-link-saved");

new aws.iam.RolePolicy("save-link-link-saved-sqs-send", {
	role: linkSavedRole.name,
	policy: generateSummaryQueue.queueArn.apply((arn) =>
		JSON.stringify({
			Version: "2012-10-17",
			Statement: [
				{
					Effect: "Allow",
					Action: ["sqs:SendMessage"],
					Resource: [arn],
				},
			],
		}),
	),
});

const linkSavedLambda = new aws.lambda.Function("save-link-link-saved", {
	runtime: aws.lambda.Runtime.NodeJS22dX,
	handler: "index.handler",
	role: linkSavedRole.arn,
	code: buildLambda(
		"link-saved",
		"./src/link-saved-handler.ts",
		".lib/link-saved",
	),
	memorySize: 256,
	timeout: 60,
	environment: {
		variables: {
			GENERATE_SUMMARY_QUEUE_URL: generateSummaryQueue.queueUrl,
		},
	},
});

new aws.lambda.EventSourceMapping("save-link-link-saved-trigger", {
	eventSourceArn: linkSavedQueue.queueArn,
	functionName: linkSavedLambda.name,
	batchSize: 1,
});

new aws.iam.RolePolicy("save-link-link-saved-sqs-receive", {
	role: linkSavedRole.name,
	policy: pulumi
		.all([linkSavedQueue.queueArn])
		.apply(([queueArn]) =>
			JSON.stringify({
				Version: "2012-10-17",
				Statement: [
					{
						Effect: "Allow",
						Action: [
							"sqs:ReceiveMessage",
							"sqs:DeleteMessage",
							"sqs:GetQueueAttributes",
						],
						Resource: [queueArn],
					},
				],
			}),
		),
});

// --- Generate Summary Lambda ---

const generateSummaryRole = createLambdaRole("save-link-generate-summary");

new aws.iam.RolePolicy("save-link-generate-summary-eventbridge-publish", {
	role: generateSummaryRole.name,
	policy: eventBusArn.apply((arn) =>
		JSON.stringify({
			Version: "2012-10-17",
			Statement: [
				{
					Effect: "Allow",
					Action: ["events:PutEvents"],
					Resource: [arn],
				},
			],
		}),
	),
});

const generateSummaryLambda = new aws.lambda.Function(
	"save-link-generate-summary",
	{
		runtime: aws.lambda.Runtime.NodeJS22dX,
		handler: "index.handler",
		role: generateSummaryRole.arn,
		code: buildLambda(
			"generate-summary",
			"./src/generate-summary-handler.ts",
			".lib/generate-summary",
		),
		memorySize: 256,
		timeout: 120,
		environment: {
			variables: {
				EVENT_BUS_NAME: eventBusName,
			},
		},
	},
);

new aws.lambda.EventSourceMapping("save-link-generate-summary-trigger", {
	eventSourceArn: generateSummaryQueue.queueArn,
	functionName: generateSummaryLambda.name,
	batchSize: 1,
});

new aws.iam.RolePolicy("save-link-generate-summary-sqs-receive", {
	role: generateSummaryRole.name,
	policy: generateSummaryQueue.queueArn.apply((arn) =>
		JSON.stringify({
			Version: "2012-10-17",
			Statement: [
				{
					Effect: "Allow",
					Action: [
						"sqs:ReceiveMessage",
						"sqs:DeleteMessage",
						"sqs:GetQueueAttributes",
					],
					Resource: [arn],
				},
			],
		}),
	),
});

// --- Summary Generated Lambda ---

const summaryGeneratedRole = createLambdaRole("save-link-summary-generated");

const summaryGeneratedLambda = new aws.lambda.Function(
	"save-link-summary-generated",
	{
		runtime: aws.lambda.Runtime.NodeJS22dX,
		handler: "index.handler",
		role: summaryGeneratedRole.arn,
		code: buildLambda(
			"summary-generated",
			"./src/summary-generated-handler.ts",
			".lib/summary-generated",
		),
		memorySize: 256,
		timeout: 60,
	},
);

new aws.lambda.EventSourceMapping("save-link-summary-generated-trigger", {
	eventSourceArn: summaryGeneratedQueue.queueArn,
	functionName: summaryGeneratedLambda.name,
	batchSize: 1,
});

new aws.iam.RolePolicy("save-link-summary-generated-sqs-receive", {
	role: summaryGeneratedRole.name,
	policy: summaryGeneratedQueue.queueArn.apply((arn) =>
		JSON.stringify({
			Version: "2012-10-17",
			Statement: [
				{
					Effect: "Allow",
					Action: [
						"sqs:ReceiveMessage",
						"sqs:DeleteMessage",
						"sqs:GetQueueAttributes",
					],
					Resource: [arn],
				},
			],
		}),
	),
});

// --- Exports ---

export const linkSavedQueueUrl = linkSavedQueue.queueUrl;
export const generateSummaryQueueUrl = generateSummaryQueue.queueUrl;
export const summaryGeneratedQueueUrl = summaryGeneratedQueue.queueUrl;
export const linkSavedFunctionName = linkSavedLambda.name;
export const generateSummaryFunctionName = generateSummaryLambda.name;
export const summaryGeneratedFunctionName = summaryGeneratedLambda.name;
