import * as pulumi from "@pulumi/pulumi";
import assert from "node:assert";
import { DomainRegistration } from "./domain-registration";
import { HutchStorage } from "./hutch-storage";
import { HutchStaticAssets } from "./hutch-static-assets";
import { HutchLambda } from "./hutch-lambda";

const config = new pulumi.Config();
const stage = config.require("stage");
const domains = config.getObject<string[]>("domains") ?? [];
const deletionProtection = config.requireBoolean("deletionProtection");
const staticDomains = config.requireObject<string[]>("staticDomains");
assert(staticDomains.length > 0, "staticDomains must have at least one entry");
const staticBucketName = config.require("staticBucketName");
const tableNames = {
	articles: config.require("dynamodbArticlesTable"),
	userArticles: config.require("dynamodbUserArticlesTable"),
	users: config.require("dynamodbUsersTable"),
	sessions: config.require("dynamodbSessionsTable"),
	oauth: config.require("dynamodbOauthTable"),
	verificationTokens: config.require("dynamodbVerificationTokensTable"),
	featureVotes: config.require("dynamodbFeatureVotesTable"),
};

const storage = new HutchStorage("hutch", {
	deletionProtection,
	tableNames,
});

const domainRegistration = new DomainRegistration("hutch-domain", { domains });

const staticAssets = new HutchStaticAssets("hutch-static", {
	bucketName: staticBucketName,
	staticDomains,
	domains,
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
