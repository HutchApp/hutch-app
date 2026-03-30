import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { build, type Loader } from "esbuild";
import assert from "node:assert";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getEnv, requireEnv } from "../runtime/require-env";
import type { HutchStorage } from "./hutch-storage";
import type { DomainRegistration } from "./domain-registration";

const esbuildLoaders: Record<string, Loader> = {
	".ts": "ts",
};

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

export class HutchLambda {
	public readonly apiUrl: pulumi.Output<string> | string;
	public readonly functionName: pulumi.Output<string>;
	public readonly defaultRoute: aws.apigatewayv2.Route;

	constructor(
		name: string,
		args: {
			stage: string;
			storage: HutchStorage;
			domainRegistration: DomainRegistration;
			staticBaseUrl: pulumi.Output<string>;
			eventBusName: pulumi.Output<string>;
			eventBusArn: pulumi.Output<string>;
		},
	) {
		const memorySize = 512;
		const timeout = 30;
		const lambdaOutputDir = ".lib/hutch-api";

		const lambdaCode = build({
			entryPoints: ["./src/infra/lambda.ts"],
			bundle: true,
			sourcemap: true,
			platform: "node",
			format: "cjs",
			minify: true,
			outfile: `${lambdaOutputDir}/index.js`,
			target: ["node22"],
			loader: esbuildLoaders,
		}).then(() => {
			mkdirSync(lambdaOutputDir, { recursive: true });
			copyAssetFiles({ src: "./src/runtime", dest: lambdaOutputDir });
			return new pulumi.asset.AssetArchive({
				".": new pulumi.asset.FileArchive(lambdaOutputDir),
			});
		});

		const lambdaRole = new aws.iam.Role(`${name}-lambda-role`, {
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

		new aws.iam.RolePolicyAttachment(`${name}-lambda-basic-execution`, {
			role: lambdaRole.name,
			policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
		});

		new aws.iam.RolePolicy(`${name}-dynamodb-access`, {
			role: lambdaRole.name,
			policy: pulumi
				.all([
					args.storage.articlesTable.arn,
					args.storage.userArticlesTable.arn,
					args.storage.usersTable.arn,
					args.storage.sessionsTable.arn,
					args.storage.oauthTable.arn,
					args.storage.verificationTokensTable.arn,
				])
				.apply(([articlesArn, userArticlesArn, usersArn, sessionsArn, oauthArn, verificationTokensArn]) =>
					JSON.stringify({
						Version: "2012-10-17",
						Statement: [
							{
								Effect: "Allow",
								Action: [
									"dynamodb:GetItem",
									"dynamodb:BatchGetItem",
									"dynamodb:PutItem",
									"dynamodb:UpdateItem",
									"dynamodb:DeleteItem",
									"dynamodb:Query",
									"dynamodb:Scan",
								],
								Resource: [
									articlesArn,
									`${articlesArn}/index/*`,
									userArticlesArn,
									`${userArticlesArn}/index/*`,
									usersArn,
									`${usersArn}/index/*`,
									sessionsArn,
									oauthArn,
									`${oauthArn}/index/*`,
									verificationTokensArn,
								],
							},
						],
					}),
				),
		});

		new aws.iam.RolePolicy(`${name}-eventbridge-publish`, {
			role: lambdaRole.name,
			policy: args.eventBusArn.apply((arn) =>
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

		const apiGateway = new aws.apigatewayv2.Api(`${name}-api-gateway`, {
			protocolType: "HTTP",
			description: `Hutch API Gateway (${args.stage})`,
		});

		const apiStage = new aws.apigatewayv2.Stage(`${name}-api-stage`, {
			apiId: apiGateway.id,
			name: "$default",
			autoDeploy: true,
		});

		const lambdaFunction = new aws.lambda.Function(`${name}-api`, {
			runtime: aws.lambda.Runtime.NodeJS22dX,
			handler: "index.handler",
			role: lambdaRole.arn,
			code: lambdaCode,
			memorySize,
			timeout,
			environment: {
				variables: {
					NODE_ENV: "production",
					PERSISTENCE: "prod",
					APP_ORIGIN: args.domainRegistration.domains.length > 0
						? `https://${args.domainRegistration.primaryDomain}`
						: apiGateway.apiEndpoint,
					DYNAMODB_ARTICLES_TABLE: args.storage.articlesTable.name,
					DYNAMODB_USER_ARTICLES_TABLE: args.storage.userArticlesTable.name,
					DYNAMODB_USERS_TABLE: args.storage.usersTable.name,
					DYNAMODB_SESSIONS_TABLE: args.storage.sessionsTable.name,
					DYNAMODB_OAUTH_TABLE: args.storage.oauthTable.name,
					DYNAMODB_VERIFICATION_TOKENS_TABLE: args.storage.verificationTokensTable.name,
					RESEND_API_KEY: pulumi.runtime.isDryRun()
						? (getEnv("RESEND_API_KEY") ?? "")
						: requireEnv("RESEND_API_KEY"),
					ANTHROPIC_API_KEY: pulumi.runtime.isDryRun()
						? (getEnv("ANTHROPIC_API_KEY") ?? "")
						: requireEnv("ANTHROPIC_API_KEY"),
					STATIC_BASE_URL: args.staticBaseUrl,
					EVENT_BUS_NAME: args.eventBusName,
				},
			},
		});

		const lambdaIntegration = new aws.apigatewayv2.Integration(
			`${name}-lambda-integration`,
			{
				apiId: apiGateway.id,
				integrationType: "AWS_PROXY",
				integrationUri: lambdaFunction.arn,
				payloadFormatVersion: "2.0",
			},
		);

		this.defaultRoute = new aws.apigatewayv2.Route(
			`${name}-default-route`,
			{
				apiId: apiGateway.id,
				routeKey: "$default",
				target: pulumi.interpolate`integrations/${lambdaIntegration.id}`,
			},
		);

		new aws.lambda.Permission(`${name}-api-gateway-permission`, {
			action: "lambda:InvokeFunction",
			function: lambdaFunction.name,
			principal: "apigateway.amazonaws.com",
			sourceArn: pulumi.interpolate`${apiGateway.executionArn}/*/*`,
		});

		if (args.domainRegistration.domains.length > 0) {
			const dr = args.domainRegistration;
			assert(dr.certificateArn, "DomainRegistration with domains must have certificateArn");
			assert(dr.zoneId, "DomainRegistration with domains must have zoneId");

			for (const domain of dr.domains) {
				const safeName = domain.replace(/\./g, "-");

				const customDomain = new aws.apigatewayv2.DomainName(
					`${name}-domain-${safeName}`,
					{
						domainName: domain,
						domainNameConfiguration: {
							certificateArn: dr.certificateArn,
							endpointType: "REGIONAL",
							securityPolicy: "TLS_1_2",
						},
					},
				);

				new aws.apigatewayv2.ApiMapping(
					`${name}-mapping-${safeName}`,
					{
						apiId: apiGateway.id,
						domainName: customDomain.domainName,
						stage: apiStage.id,
					},
				);

				new aws.route53.Record(`${name}-record-${safeName}`, {
					zoneId: dr.zoneId,
					name: domain,
					type: "A",
					aliases: [
						{
							name: customDomain.domainNameConfiguration.apply(
								(c) => c.targetDomainName,
							),
							zoneId:
								customDomain.domainNameConfiguration.apply(
									(c) => c.hostedZoneId,
								),
							evaluateTargetHealth: false,
						},
					],
				});
			}

			this.apiUrl = `https://${dr.primaryDomain}`;
		} else {
			this.apiUrl = pulumi.interpolate`${apiGateway.apiEndpoint}/${apiStage.name}`;
		}

		this.functionName = lambdaFunction.name;
	}
}
