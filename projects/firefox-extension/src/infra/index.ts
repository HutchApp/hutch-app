import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as assert from "node:assert";
import * as fs from "node:fs";
import { join } from "node:path";
import { S3_CONFIG, getBucketName } from "../../s3-config";

const config = new pulumi.Config();
const stage = config.require("stage");

const bucket = new aws.s3.Bucket("hutch-extension", {
	bucket: getBucketName(stage),
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

const distFilesDir = join(__dirname, "..", "..", "dist-extension-files");
const xpiFiles = fs
	.readdirSync(distFilesDir)
	.filter((f) => f.startsWith("hutch-") && f.endsWith(".xpi"));
assert.ok(
	xpiFiles.length === 1,
	`Expected exactly one xpi file in ${distFilesDir}, found: ${xpiFiles.length}. Run 'pnpm compile' first.`,
);
const xpiFilename = xpiFiles[0];
const xpiPath = join(distFilesDir, xpiFilename);

const extensionObject = new aws.s3.BucketObject("hutch-xpi", {
	bucket: bucket.id,
	key: S3_CONFIG.key,
	source: new pulumi.asset.FileAsset(xpiPath),
	contentType: "application/x-xpinstall",
	contentDisposition: `attachment; filename="${xpiFilename}"`,
});

export const downloadUrl = pulumi.interpolate`https://${bucket.bucketRegionalDomainName}/${S3_CONFIG.key}`;
export const _dependencies = [bucketPolicy, extensionObject];
