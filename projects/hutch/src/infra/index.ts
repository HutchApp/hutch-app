import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { build, type Loader } from "esbuild";
import assert from "node:assert";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getEnv, requireEnv } from "../runtime/require-env";

const config = new pulumi.Config();
const stage = config.require("stage");
const domains = config.getObject<string[]>("domains") ?? [];
const deletionProtection = config.requireBoolean("deletionProtection");
const staticDomains = config.getObject<string[]>("staticDomains") ?? [];
const staticBucketName = config.require("staticBucketName");
const tableNames = {
	articles: config.require("dynamodbArticlesTable"),
	userArticles: config.require("dynamodbUserArticlesTable"),
	users: config.require("dynamodbUsersTable"),
	sessions: config.require("dynamodbSessionsTable"),
	oauth: config.require("dynamodbOauthTable"),
	verificationTokens: config.require("dynamodbVerificationTokensTable"),
};

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
	public readonly certificateArn?: pulumi.Output<string>;
	public readonly zoneId?: Promise<string>;
	public readonly domains: string[];
	public readonly primaryDomain?: string;

	constructor(name: string, args: { domains: string[] }) {
		this.domains = args.domains;

		if (args.domains.length === 0) return;

		const [primaryDomain, ...altDomains] = args.domains;
		this.primaryDomain = primaryDomain;

		const zone = aws.route53.getZone({ name: primaryDomain });
		const zoneId = zone.then((z) => z.zoneId);
		this.zoneId = zoneId;

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
						zoneId,
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
	public readonly userArticlesTable: aws.dynamodb.Table;
	public readonly usersTable: aws.dynamodb.Table;
	public readonly sessionsTable: aws.dynamodb.Table;
	public readonly oauthTable: aws.dynamodb.Table;
	public readonly verificationTokensTable: aws.dynamodb.Table;

	constructor(_name: string, args: { deletionProtection: boolean; tableNames: {
		articles: string;
		userArticles: string;
		users: string;
		sessions: string;
		oauth: string;
		verificationTokens: string;
	} }) {
		this.articlesTable = new aws.dynamodb.Table(`hutch-articles`, {
			name: args.tableNames.articles,
			billingMode: "PAY_PER_REQUEST",
			deletionProtectionEnabled: args.deletionProtection,
			hashKey: "url",
			attributes: [
				{ name: "url", type: "S" },
				{ name: "routeId", type: "S" },
			],
			globalSecondaryIndexes: [
				{
					name: "routeId-index",
					hashKey: "routeId",
					projectionType: "ALL",
				},
			],
		});

		this.userArticlesTable = new aws.dynamodb.Table(`hutch-user-articles`, {
			name: args.tableNames.userArticles,
			billingMode: "PAY_PER_REQUEST",
			deletionProtectionEnabled: args.deletionProtection,
			hashKey: "userId",
			rangeKey: "url",
			attributes: [
				{ name: "userId", type: "S" },
				{ name: "url", type: "S" },
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
			name: args.tableNames.users,
			billingMode: "PAY_PER_REQUEST",
			deletionProtectionEnabled: args.deletionProtection,
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
			name: args.tableNames.sessions,
			billingMode: "PAY_PER_REQUEST",
			hashKey: "sessionId",
			attributes: [{ name: "sessionId", type: "S" }],
			ttl: {
				attributeName: "expiresAt",
				enabled: true,
			},
		});

		this.oauthTable = new aws.dynamodb.Table(`hutch-oauth`, {
			name: args.tableNames.oauth,
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
			name: args.tableNames.verificationTokens,
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

class HutchStaticAssets {
	public readonly baseUrl: pulumi.Output<string>;

	constructor(
		name: string,
		args: {
			bucketName: string;
			staticDomains: string[];
			zoneId?: Promise<string>;
		},
	) {
		const bucket = new aws.s3.Bucket(`${name}-bucket`, {
			bucket: args.bucketName,
			forceDestroy: true,
		});

		const publicAccessBlock = new aws.s3.BucketPublicAccessBlock(`${name}-public-access`, {
			bucket: bucket.id,
			blockPublicAcls: false,
			blockPublicPolicy: false,
			ignorePublicAcls: false,
			restrictPublicBuckets: false,
		});

		new aws.s3.BucketPolicy(
			`${name}-policy`,
			{
				bucket: bucket.id,
				policy: bucket.arn.apply((arn) =>
					JSON.stringify({
						Version: "2012-10-17",
						Statement: [
							{
								Effect: "Allow",
								Principal: "*",
								Action: "s3:GetObject",
								Resource: `${arn}/*`,
							},
						],
					}),
				),
			},
			{ dependsOn: [publicAccessBlock] },
		);

		let viewerCertificate: aws.types.input.cloudfront.DistributionViewerCertificate;
		let aliases: pulumi.Input<string>[] | undefined;
		let certificateArn: pulumi.Output<string> | undefined;

		if (args.staticDomains.length > 0) {
			assert(args.zoneId, "HutchStaticAssets with staticDomains must have zoneId");
			const zoneId = args.zoneId;

			const usEast1 = new aws.Provider(`${name}-us-east-1`, {
				region: "us-east-1",
			});

			const [primaryDomain, ...altDomains] = args.staticDomains;

			const cert = new aws.acm.Certificate(
				`${name}-cert`,
				{
					domainName: primaryDomain,
					subjectAlternativeNames:
						altDomains.length > 0 ? altDomains : undefined,
					validationMethod: "DNS",
				},
				{ provider: usEast1 },
			);

			const validationRecords = cert.domainValidationOptions.apply(
				(opts) =>
					opts.map(
						(opt, i) =>
							new aws.route53.Record(
								`${name}-cert-validation-${i}`,
								{
									zoneId,
									name: opt.resourceRecordName,
									type: opt.resourceRecordType,
									records: [opt.resourceRecordValue],
									ttl: 300,
								},
							),
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
				{ provider: usEast1 },
			);

			certificateArn = validated.certificateArn;
			aliases = args.staticDomains;
			viewerCertificate = {
				acmCertificateArn: certificateArn,
				sslSupportMethod: "sni-only",
				minimumProtocolVersion: "TLSv1.2_2021",
			};
		} else {
			viewerCertificate = {
				cloudfrontDefaultCertificate: true,
			};
		}

		const distribution = new aws.cloudfront.Distribution(
			`${name}-cdn`,
			{
				enabled: true,
				aliases,
				origins: [
					{
						originId: "s3",
						domainName: bucket.bucketRegionalDomainName,
					},
				],
				defaultCacheBehavior: {
					targetOriginId: "s3",
					viewerProtocolPolicy: "redirect-to-https",
					allowedMethods: ["GET", "HEAD"],
					cachedMethods: ["GET", "HEAD"],
					compress: true,
					cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
				},
				restrictions: {
					geoRestriction: {
						restrictionType: "none",
					},
				},
				viewerCertificate,
				priceClass: "PriceClass_100",
			},
		);

		if (args.staticDomains.length > 0) {
			assert(args.zoneId, "HutchStaticAssets with staticDomains must have zoneId");
			const zoneId = args.zoneId;

			for (const domain of args.staticDomains) {
				const safeName = domain.replace(/\./g, "-");

				new aws.route53.Record(`${name}-record-${safeName}`, {
					zoneId,
					name: domain,
					type: "A",
					aliases: [
						{
							name: distribution.domainName,
							zoneId: distribution.hostedZoneId,
							evaluateTargetHealth: false,
						},
					],
				});
			}

			this.baseUrl = pulumi.output(`https://${args.staticDomains[0]}`);
		} else {
			this.baseUrl = pulumi.interpolate`https://${distribution.domainName}`;
		}
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
			domainRegistration: DomainRegistration;
			staticBaseUrl: pulumi.Output<string>;
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

const storage = new HutchStorage("hutch", {
	deletionProtection,
	tableNames,
});

const domainRegistration = new DomainRegistration("hutch-domain", { domains });

const staticAssets = new HutchStaticAssets("hutch-static", {
	bucketName: staticBucketName,
	staticDomains,
	zoneId: domainRegistration.zoneId,
});

const hutch = new HutchLambda("hutch", {
	stage,
	storage,
	domainRegistration,
	staticBaseUrl: staticAssets.baseUrl,
});

export const apiUrl = hutch.apiUrl;
export const functionName = hutch.functionName;
export const staticBaseUrl = staticAssets.baseUrl;
export const _dependencies = [hutch.defaultRoute];
