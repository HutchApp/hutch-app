import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { build } from "esbuild";

const config = new pulumi.Config();
const stage = config.require("stage");
const memorySize = 512;
const timeout = 30;

const lambdaCode = build({
	entryPoints: ["./src/infra/lambda.ts"],
	bundle: true,
	sourcemap: true,
	platform: "node",
	format: "cjs",
	minify: true,
	outfile: ".lib/hutch-api/index.js",
	target: ["node22"],
}).then(
	() =>
		new pulumi.asset.AssetArchive({
			".": new pulumi.asset.FileArchive(".lib/hutch-api"),
		}),
);

const lambdaRole = new aws.iam.Role("hutch-lambda-role", {
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

new aws.iam.RolePolicyAttachment("hutch-lambda-basic-execution", {
	role: lambdaRole.name,
	policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
});

const lambdaFunction = new aws.lambda.Function("hutch-api", {
	runtime: aws.lambda.Runtime.NodeJS22dX,
	handler: "index.handler",
	role: lambdaRole.arn,
	code: lambdaCode,
	memorySize,
	timeout,
	environment: {
		variables: {
			NODE_ENV: "production",
			STAGE: stage,
		},
	},
});

const apiGateway = new aws.apigatewayv2.Api("hutch-api-gateway", {
	protocolType: "HTTP",
	description: `Hutch API Gateway (${stage})`,
});

const lambdaIntegration = new aws.apigatewayv2.Integration(
	"hutch-lambda-integration",
	{
		apiId: apiGateway.id,
		integrationType: "AWS_PROXY",
		integrationUri: lambdaFunction.arn,
		payloadFormatVersion: "2.0",
	},
);

const defaultRoute = new aws.apigatewayv2.Route("hutch-default-route", {
	apiId: apiGateway.id,
	routeKey: "$default",
	target: pulumi.interpolate`integrations/${lambdaIntegration.id}`,
});

const apiStage = new aws.apigatewayv2.Stage("hutch-api-stage", {
	apiId: apiGateway.id,
	name: stage,
	autoDeploy: true,
});

new aws.lambda.Permission("hutch-api-gateway-permission", {
	action: "lambda:InvokeFunction",
	function: lambdaFunction.name,
	principal: "apigateway.amazonaws.com",
	sourceArn: pulumi.interpolate`${apiGateway.executionArn}/*/*`,
});

export const apiUrl = pulumi.interpolate`${apiGateway.apiEndpoint}/${apiStage.name}`;
export const functionName = lambdaFunction.name;

// Ensure defaultRoute is created before stack outputs are resolved
export const _dependencies = [defaultRoute];
