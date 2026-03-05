import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as assert from "node:assert";
import { join } from "node:path";

const config = new pulumi.Config();
const stage = config.require("stage");

const bucket = new aws.s3.Bucket("hutch-extension", {
	bucket: `hutch-extension-${stage}`,
	forceDestroy: true,
});

new aws.s3.BucketPublicAccessBlock("hutch-extension-public-access", {
	bucket: bucket.id,
	blockPublicAcls: false,
	blockPublicPolicy: false,
	ignorePublicAcls: false,
	restrictPublicBuckets: false,
});

const bucketPolicy = new aws.s3.BucketPolicy("hutch-extension-policy", {
	bucket: bucket.id,
	policy: bucket.arn.apply((arn) =>
		JSON.stringify({
			Version: "2012-10-17",
			Statement: [
				{
					Sid: "PublicReadGetObject",
					Effect: "Allow",
					Principal: "*",
					Action: "s3:GetObject",
					Resource: `${arn}/*`,
				},
			],
		}),
	),
});

const xpiPath = join(__dirname, "..", "dist-artifacts", "hutch.xpi");
assert.ok(
	require("node:fs").existsSync(xpiPath),
	`Extension artifact not found: ${xpiPath}. Run 'pnpm compile' first.`,
);

const extensionObject = new aws.s3.BucketObject("hutch-xpi", {
	bucket: bucket.id,
	key: "hutch.xpi",
	source: new pulumi.asset.FileAsset(xpiPath),
	contentType: "application/x-xpinstall",
});

export const downloadUrl = pulumi.interpolate`https://${bucket.bucketRegionalDomainName}/hutch.xpi`;
export const _dependencies = [bucketPolicy, extensionObject];
