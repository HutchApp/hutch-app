import * as aws from "@pulumi/aws";
import type * as pulumi from "@pulumi/pulumi";

export class HutchS3PublicRead {
	public readonly bucket: aws.s3.Bucket["bucket"];
	public readonly arn: aws.s3.Bucket["arn"];
	public readonly bucketRegionalDomainName: aws.s3.Bucket["bucketRegionalDomainName"];
	public readonly bucketPolicy: aws.s3.BucketPolicy;

	constructor(
		name: string,
		args: {
			bucketName: pulumi.Input<string>;
			bucketOpts?: pulumi.CustomResourceOptions;
		},
	) {
		const bucket = new aws.s3.Bucket(name, {
			bucket: args.bucketName,
			forceDestroy: true,
		}, args.bucketOpts);

		const publicAccessBlock = new aws.s3.BucketPublicAccessBlock(`${name}-public-access`, {
			bucket: bucket.id,
			blockPublicAcls: false,
			blockPublicPolicy: false,
			ignorePublicAcls: false,
			restrictPublicBuckets: false,
		});

		this.bucketPolicy = new aws.s3.BucketPolicy(
			`${name}-policy`,
			{
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
			},
			{ dependsOn: [publicAccessBlock] },
		);

		this.bucket = bucket.bucket;
		this.arn = bucket.arn;
		this.bucketRegionalDomainName = bucket.bucketRegionalDomainName;
	}
}
