import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { getBucketName } from "../../s3-config";

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

export const bucketUrl = pulumi.interpolate`https://${bucket.bucketRegionalDomainName}`;
export const _dependencies = [bucketPolicy];
