import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config();
const stage = config.require("stage");

const bucket = new aws.s3.Bucket("hutch-chrome-extension", {
	bucket: `hutch-chrome-extension-${stage}`,
	forceDestroy: true,
});

new aws.s3.BucketPublicAccessBlock("hutch-chrome-extension-public-access", {
	bucket: bucket.id,
	blockPublicAcls: false,
	blockPublicPolicy: false,
	ignorePublicAcls: false,
	restrictPublicBuckets: false,
});

const bucketPolicy = new aws.s3.BucketPolicy("hutch-chrome-extension-policy", {
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
				{
					Sid: "PublicListBucket",
					Effect: "Allow",
					Principal: "*",
					Action: "s3:ListBucket",
					Resource: arn,
				},
			],
		}),
	),
});

export const bucketUrl = pulumi.interpolate`https://${bucket.bucketRegionalDomainName}`;
export const _dependencies = [bucketPolicy];
