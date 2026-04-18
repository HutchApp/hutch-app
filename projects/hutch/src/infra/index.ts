import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import assert from "node:assert";
import { resolve } from "node:path";
import { HutchLambda, HutchAPIGateway, HutchDynamoDBAccess, HutchEventBus, HutchS3ReadWrite } from "@packages/hutch-infra-components/infra";
import { DomainRegistration } from "./domain-registration";
import { DomainRedirect } from "./domain-redirect";
import { HutchStorage } from "./hutch-storage";
import { HutchStaticAssets } from "./hutch-static-assets";
import { getEnv, requireEnv } from "../runtime/require-env";

const config = new pulumi.Config();
const stage = config.require("stage");
const domains = config.getObject<string[]>("domains") ?? [];
const deletionProtection = config.requireBoolean("deletionProtection");
const staticDomains = config.requireObject<string[]>("staticDomains");
assert(staticDomains.length > 0, "staticDomains must have at least one entry");
const staticBucketName = config.require("staticBucketName");
const contentBucketName = config.require("contentBucketName");
const tableNames = {
	articles: config.require("dynamodbArticlesTable"),
	userArticles: config.require("dynamodbUserArticlesTable"),
	users: config.require("dynamodbUsersTable"),
	sessions: config.require("dynamodbSessionsTable"),
	oauth: config.require("dynamodbOauthTable"),
	verificationTokens: config.require("dynamodbVerificationTokensTable"),
	passwordResetTokens: config.require("dynamodbPasswordResetTokensTable"),
};

const storage = new HutchStorage("hutch", {
	deletionProtection,
	tableNames,
});

const redirectDomains = config.getObject<string[]>("redirectDomains") ?? [];

/**
 * Ordering convention:
 *   domains[0]           — legacy primary; keeps the original Pulumi resource names
 *                          ("hutch-domain", HutchAPIGateway's internal custom-domain wiring)
 *                          so existing deployments see a no-op.
 *   domains[1..]         — additional canonicals added during migration; each gets its own
 *                          DomainRegistration and API Gateway wiring with suffixed names.
 *   domains[last]        — canonical user-facing origin (SEO, emails, OAuth). Latest entry
 *                          wins so migrating to a new canonical just means appending.
 */
const [legacyPrimaryDomain, ...additionalDomains] = domains;
const canonicalDomain: string | undefined = domains[domains.length - 1];

const legacyDomainRegistration = new DomainRegistration("hutch-domain", {
	domains: legacyPrimaryDomain ? [legacyPrimaryDomain] : [],
});

const additionalDomainRegistrations = additionalDomains.map((domain) =>
	new DomainRegistration(`hutch-domain-${domain.replace(/\./g, "-")}`, { domains: [domain] }),
);

const allDomainRegistrations = [legacyDomainRegistration, ...additionalDomainRegistrations];

if (redirectDomains.length > 0) {
	assert(canonicalDomain, "redirectDomains requires domains to be configured");
	new DomainRedirect("hutch-redirect", {
		redirectDomains,
		targetDomain: canonicalDomain,
	});
}

const staticDomainEntries = staticDomains.map((staticDomain) => {
	const parentIndex = domains.findIndex((d) => staticDomain.endsWith(`.${d}`));
	const parentRegistration = parentIndex >= 0 ? allDomainRegistrations[parentIndex] : undefined;
	return parentRegistration?.zoneId
		? { domain: staticDomain, zoneId: parentRegistration.zoneId }
		: { domain: staticDomain };
});

const staticAssets = new HutchStaticAssets("hutch-static", {
	bucketName: staticBucketName,
	staticDomains: staticDomainEntries,
	domains,
	sourceDir: resolve(__dirname, "../../static-assets"),
});

const eventBus = HutchEventBus.fromPlatformStack(config);

const dynamodb = new HutchDynamoDBAccess("hutch-dynamodb-access", {
	tables: [
		{ arn: storage.articlesTable.arn, includeIndexes: true },
		{ arn: storage.userArticlesTable.arn, includeIndexes: true },
		{ arn: storage.usersTable.arn, includeIndexes: true },
		{ arn: storage.sessionsTable.arn, includeIndexes: false },
		{ arn: storage.oauthTable.arn, includeIndexes: true },
		{ arn: storage.verificationTokensTable.arn, includeIndexes: false },
		{ arn: storage.passwordResetTokensTable.arn, includeIndexes: false },
	],
	actions: [
		"dynamodb:GetItem",
		"dynamodb:BatchGetItem",
		"dynamodb:PutItem",
		"dynamodb:UpdateItem",
		"dynamodb:DeleteItem",
		"dynamodb:Query",
		"dynamodb:Scan",
	],
});

const logGroup = new aws.cloudwatch.LogGroup("hutch-log-analytics", {
	name: "/aws/lambda/hutch-handler",
	retentionInDays: 30,
}, { import: "/aws/lambda/hutch-handler" });

const api = new aws.apigatewayv2.Api("hutch-api-gateway", {
	name: "hutch-api-gateway",
	protocolType: "HTTP",
	description: `Readplace API Gateway (${stage})`,
});

export const appOrigin: pulumi.Input<string> = canonicalDomain
	? `https://${canonicalDomain}`
	: api.apiEndpoint;

const lambda = new HutchLambda("hutch", {
	entryPoint: "./src/infra/lambda.ts",
	outputDir: ".lib/hutch-api",
	assetDir: "./src/runtime",
	memorySize: 512,
	timeout: 30,
	environment: {
		NODE_ENV: "production",
		PERSISTENCE: "prod",
		APP_ORIGIN: appOrigin,
		DYNAMODB_ARTICLES_TABLE: storage.articlesTable.name,
		DYNAMODB_USER_ARTICLES_TABLE: storage.userArticlesTable.name,
		DYNAMODB_USERS_TABLE: storage.usersTable.name,
		DYNAMODB_SESSIONS_TABLE: storage.sessionsTable.name,
		DYNAMODB_OAUTH_TABLE: storage.oauthTable.name,
		DYNAMODB_VERIFICATION_TOKENS_TABLE: storage.verificationTokensTable.name,
		DYNAMODB_PASSWORD_RESET_TOKENS_TABLE: storage.passwordResetTokensTable.name,
		GOOGLE_LOGIN_CLIENT_ID: requireEnv("GOOGLE_LOGIN_CLIENT_ID"),
		GOOGLE_LOGIN_CLIENT_SECRET: requireEnv("GOOGLE_LOGIN_CLIENT_SECRET"),
		RESEND_API_KEY: pulumi.runtime.isDryRun()
			? (getEnv("RESEND_API_KEY") ?? "")
			: requireEnv("RESEND_API_KEY"),
		STATIC_BASE_URL: staticAssets.baseUrl,
		EVENT_BUS_NAME: eventBus.eventBusName,
		CONTENT_BUCKET_NAME: contentBucketName,
		ANALYTICS_SALT: requireEnv("ANALYTICS_SALT"),
	},
	policies: [
		...dynamodb.policies,
		...HutchS3ReadWrite.readPoliciesForBucket("hutch-content-s3", contentBucketName),
	],
});

eventBus.grantPublish(lambda);

const gateway = new HutchAPIGateway("hutch", {
	api,
	lambda: lambda,
	stage,
	domains: legacyPrimaryDomain ? [legacyPrimaryDomain] : [],
	zoneId: legacyDomainRegistration.zoneId,
	certificateArn: legacyDomainRegistration.certificateArn,
});

for (const [i, domain] of additionalDomains.entries()) {
	const safeName = domain.replace(/\./g, "-");
	const registration = additionalDomainRegistrations[i];
	assert(registration.certificateArn, `${domain} registration must have a certificate`);
	assert(registration.zoneId, `${domain} registration must have a zoneId`);

	const customDomain = new aws.apigatewayv2.DomainName(
		`hutch-apigw-domain-${safeName}`,
		{
			domainName: domain,
			domainNameConfiguration: {
				certificateArn: registration.certificateArn,
				endpointType: "REGIONAL",
				securityPolicy: "TLS_1_2",
			},
		},
	);

	new aws.apigatewayv2.ApiMapping(
		`hutch-apigw-mapping-${safeName}`,
		{
			apiId: api.id,
			domainName: customDomain.domainName,
			stage: "$default",
		},
		{ dependsOn: [gateway] },
	);

	new aws.route53.Record(`hutch-apigw-record-${safeName}`, {
		zoneId: registration.zoneId,
		name: domain,
		type: "A",
		aliases: [
			{
				name: customDomain.domainNameConfiguration.apply((c) => c.targetDomainName),
				zoneId: customDomain.domainNameConfiguration.apply((c) => c.hostedZoneId),
				evaluateTargetHealth: false,
			},
		],
	});
}

// --- Analytics Dashboard ---

const region = aws.config.requireRegion();

function logWidget(params: {
	title: string;
	logGroupName: string;
	query: string;
	x: number;
	y: number;
	width: number;
	height: number;
	view: "pie" | "table" | "bar" | "timeSeries";
}) {
	return {
		type: "log",
		x: params.x,
		y: params.y,
		width: params.width,
		height: params.height,
		properties: {
			region,
			title: params.title,
			query: `SOURCE '${params.logGroupName}' | ${params.query}`,
			view: params.view,
		},
	};
}

new aws.cloudwatch.Dashboard("readplace-analytics", {
	dashboardName: "readplace-analytics",
	dashboardBody: pulumi.output(logGroup.name).apply((logGroupName) =>
		JSON.stringify({
			widgets: [
				logWidget({
					title: "UTM Source (%)",
					logGroupName,
					query: [
						"fields @timestamp, utm_source",
						"| filter stream = \"analytics\" and event = \"pageview\"",
						"| filter user_agent not like /(?i)(bot|crawl|spider|slurp|preview|fetch)/",
						"| filter ispresent(utm_source) and utm_source != \"\"",
						"| stats count(*) as visits by utm_source",
						"| sort visits desc",
						"| limit 10",
					].join(" "),
					x: 0, y: 0, width: 12, height: 8,
					view: "pie",
				}),
				logWidget({
					title: "Top Referrers",
					logGroupName,
					query: [
						"fields @timestamp, referrer_host",
						"| filter stream = \"analytics\" and event = \"pageview\"",
						"| filter user_agent not like /(?i)(bot|crawl|spider|slurp|preview|fetch)/",
						"| filter ispresent(referrer_host) and referrer_host != \"\"",
						"| stats count(*) as visits by referrer_host",
						"| sort visits desc",
						"| limit 10",
					].join(" "),
					x: 12, y: 0, width: 12, height: 8,
					view: "pie",
				}),
				logWidget({
					title: "Recent Analytics Events",
					logGroupName,
					query: [
						"fields @timestamp, path, utm_source, utm_medium, utm_campaign, utm_content, referrer_host, visitor_hash, is_authenticated",
						"| filter stream = \"analytics\"",
						"| sort @timestamp desc",
						"| limit 50",
					].join(" "),
					x: 0, y: 8, width: 24, height: 8,
					view: "table",
				}),
				logWidget({
					title: "UTM Content (%)",
					logGroupName,
					query: [
						"fields @timestamp, utm_content",
						"| filter stream = \"analytics\" and event = \"pageview\"",
						"| filter user_agent not like /(?i)(bot|crawl|spider|slurp|preview|fetch)/",
						"| filter ispresent(utm_content) and utm_content != \"\"",
						"| stats count(*) as visits by utm_content",
						"| sort visits desc",
						"| limit 10",
					].join(" "),
					x: 0, y: 16, width: 12, height: 8,
					view: "pie",
				}),
				logWidget({
					title: "Distinct Visitors per Day",
					logGroupName,
					query: [
						"fields @timestamp, visitor_hash",
						"| filter stream = \"analytics\" and event = \"pageview\"",
						"| filter user_agent not like /(?i)(bot|crawl|spider|slurp|preview|fetch)/",
						"| filter ispresent(visitor_hash)",
						"| stats count_distinct(visitor_hash) as visitors by bin(1d)",
					].join(" "),
					x: 12, y: 16, width: 12, height: 8,
					view: "timeSeries",
				}),
				logWidget({
					title: "Distinct Authenticated Readers per Day",
					logGroupName,
					query: [
						"fields @timestamp, visitor_hash, path, is_authenticated",
						"| filter stream = \"analytics\" and event = \"pageview\"",
						"| filter user_agent not like /(?i)(bot|crawl|spider|slurp|preview|fetch)/",
						"| filter ispresent(visitor_hash) and is_authenticated",
						"| filter path like /\\/queue\\/.+\\/read$/",
						"| stats count_distinct(visitor_hash) as authenticated_readers by bin(1d)",
					].join(" "),
					x: 12, y: 24, width: 12, height: 8,
					view: "timeSeries",
				}),
			],
		}),
	),
});

// --- Exports ---

export const apiUrl: pulumi.Input<string> = canonicalDomain ? `https://${canonicalDomain}` : gateway.apiUrl;
export const functionName = lambda.functionName;
export const staticBaseUrl = staticAssets.baseUrl;
export const _dependencies = [gateway.defaultRoute];
