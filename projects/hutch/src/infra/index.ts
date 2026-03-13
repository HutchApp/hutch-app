import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { build, type Loader } from "esbuild";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { requireEnv } from "../runtime/require-env";

const config = new pulumi.Config();
const stage = config.require("stage");

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

class DomainRegistration {
	public readonly certificateArn: pulumi.Output<string>;
	public readonly zoneId: Promise<string>;
	public readonly domains: string[];
	public readonly primaryDomain: string;

	constructor(name: string, args: { domains: string[] }) {
		const [primaryDomain, ...altDomains] = args.domains;
		this.domains = args.domains;
		this.primaryDomain = primaryDomain;

		const zone = aws.route53.getZone({ name: primaryDomain });
		this.zoneId = zone.then((z) => z.zoneId);

		const cert = new aws.acm.Certificate(`${name}-cert`, {
			domainName: primaryDomain,
			subjectAlternativeNames:
				altDomains.length > 0 ? altDomains : undefined,
			validationMethod: "DNS",
		});

		const validationRecords = cert.domainValidationOptions.apply((opts) =>
			opts.map(
				(opt, i) =>
					new aws.route53.Record(`${name}-cert-validation-${i}`, {
						zoneId: this.zoneId,
						name: opt.resourceRecordName,
						type: opt.resourceRecordType,
						records: [opt.resourceRecordValue],
						ttl: 300,
					}),
			),
		);

		const validated = new aws.acm.CertificateValidation(
			`${name}-cert-validated`,
			{
				certificateArn: cert.arn,
				validationRecordFqdns: validationRecords.apply((records) =>
					records.map((r) => r.fqdn),
				),
			},
		);

		this.certificateArn = validated.certificateArn;
	}
}

class HutchStorage {
	public readonly articlesTable: aws.dynamodb.Table;
	public readonly usersTable: aws.dynamodb.Table;
	public readonly sessionsTable: aws.dynamodb.Table;
	public readonly oauthTable: aws.dynamodb.Table;
	public readonly verificationTokensTable: aws.dynamodb.Table;

	constructor(_name: string) {
		this.articlesTable = new aws.dynamodb.Table(`hutch-articles`, {
			billingMode: "PAY_PER_REQUEST",
			hashKey: "id",
			attributes: [
				{ name: "id", type: "S" },
				{ name: "userId", type: "S" },
				{ name: "savedAt", type: "S" },
			],
			globalSecondaryIndexes: [
				{
					name: "userId-savedAt-index",
					hashKey: "userId",
					rangeKey: "savedAt",
					projectionType: "ALL",
				},
			],
		});

		this.usersTable = new aws.dynamodb.Table(`hutch-users`, {
			billingMode: "PAY_PER_REQUEST",
			hashKey: "email",
			attributes: [
				{ name: "email", type: "S" },
				{ name: "userId", type: "S" },
			],
			globalSecondaryIndexes: [
				{
					name: "userId-index",
					hashKey: "userId",
					projectionType: "ALL",
				},
			],
		});

		this.sessionsTable = new aws.dynamodb.Table(`hutch-sessions`, {
			billingMode: "PAY_PER_REQUEST",
			hashKey: "sessionId",
			attributes: [{ name: "sessionId", type: "S" }],
			ttl: {
				attributeName: "expiresAt",
				enabled: true,
			},
		});

		this.oauthTable = new aws.dynamodb.Table(`hutch-oauth`, {
			billingMode: "PAY_PER_REQUEST",
			hashKey: "pk",
			attributes: [
				{ name: "pk", type: "S" },
				{ name: "userId", type: "S" },
			],
			globalSecondaryIndexes: [
				{
					name: "userId-index",
					hashKey: "userId",
					projectionType: "ALL",
				},
			],
			ttl: {
				attributeName: "expiresAt",
				enabled: true,
			},
		});

		this.verificationTokensTable = new aws.dynamodb.Table(`hutch-verification-tokens`, {
			billingMode: "PAY_PER_REQUEST",
			hashKey: "token",
			attributes: [{ name: "token", type: "S" }],
			ttl: {
				attributeName: "expiresAt",
				enabled: true,
			},
		});
	}
}

class HutchLambda {
	public readonly apiUrl: pulumi.Output<string> | string;
	public readonly functionName: pulumi.Output<string>;
	public readonly defaultRoute: aws.apigatewayv2.Route;

	constructor(
		name: string,
		args: {
			stage: string;
			storage: HutchStorage;
			domainRegistration?: DomainRegistration;
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
					args.storage.usersTable.arn,
					args.storage.sessionsTable.arn,
					args.storage.oauthTable.arn,
					args.storage.verificationTokensTable.arn,
				])
				.apply(([articlesArn, usersArn, sessionsArn, oauthArn, verificationTokensArn]) =>
					JSON.stringify({
						Version: "2012-10-17",
						Statement: [
							{
								Effect: "Allow",
								Action: [
									"dynamodb:GetItem",
									"dynamodb:PutItem",
									"dynamodb:UpdateItem",
									"dynamodb:DeleteItem",
									"dynamodb:Query",
								],
								Resource: [
									articlesArn,
									`${articlesArn}/index/*`,
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
					STAGE: args.stage,
					APP_ORIGIN: args.domainRegistration
						? `https://${args.domainRegistration.primaryDomain}`
						: "",
					DYNAMODB_ARTICLES_TABLE: args.storage.articlesTable.name,
					DYNAMODB_USERS_TABLE: args.storage.usersTable.name,
					DYNAMODB_SESSIONS_TABLE: args.storage.sessionsTable.name,
					DYNAMODB_OAUTH_TABLE: args.storage.oauthTable.name,
					DYNAMODB_VERIFICATION_TOKENS_TABLE: args.storage.verificationTokensTable.name,
					RESEND_API_KEY: requireEnv("RESEND_API_KEY"),
				},
			},
		});

		const apiGateway = new aws.apigatewayv2.Api(`${name}-api-gateway`, {
			protocolType: "HTTP",
			description: `Hutch API Gateway (${args.stage})`,
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

		const apiStage = new aws.apigatewayv2.Stage(`${name}-api-stage`, {
			apiId: apiGateway.id,
			name: args.stage,
			autoDeploy: true,
		});

		new aws.lambda.Permission(`${name}-api-gateway-permission`, {
			action: "lambda:InvokeFunction",
			function: lambdaFunction.name,
			principal: "apigateway.amazonaws.com",
			sourceArn: pulumi.interpolate`${apiGateway.executionArn}/*/*`,
		});

		if (args.domainRegistration) {
			const dr = args.domainRegistration;

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

const storage = new HutchStorage("hutch");

const hutch = new HutchLambda("hutch", {
	stage,
	storage,
	domainRegistration: new DomainRegistration("hutch-domain", {
		domains: ["hutch-app.com"],
	}),
});

export const apiUrl = hutch.apiUrl;
export const functionName = hutch.functionName;
export const _dependencies = [hutch.defaultRoute];
