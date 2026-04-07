import * as aws from "@pulumi/aws";
import type * as pulumi from "@pulumi/pulumi";
import type { LambdaPolicy } from "./hutch-lambda";

export class HutchS3ReadWrite {
	public readonly bucket: aws.s3.Bucket["bucket"];
	public readonly arn: aws.s3.Bucket["arn"];

	private readonly readPolicyDocument: pulumi.Output<string>;
	private readonly writePolicyDocument: pulumi.Output<string>;

	constructor(
		name: string,
		args: {
			bucketName: pulumi.Input<string>;
		},
	) {
		const bucket = new aws.s3.Bucket(name, {
			bucket: args.bucketName,
			forceDestroy: false,
		});

		new aws.s3.BucketPublicAccessBlock(`${name}-public-access`, {
			bucket: bucket.id,
			blockPublicAcls: true,
			blockPublicPolicy: true,
			ignorePublicAcls: true,
			restrictPublicBuckets: true,
		});

		this.bucket = bucket.bucket;
		this.arn = bucket.arn;

		this.readPolicyDocument = bucket.arn.apply((arn) =>
			JSON.stringify({
				Version: "2012-10-17",
				Statement: [{ Effect: "Allow", Action: ["s3:GetObject"], Resource: `${arn}/*` }],
			}),
		);

		this.writePolicyDocument = bucket.arn.apply((arn) =>
			JSON.stringify({
				Version: "2012-10-17",
				Statement: [{ Effect: "Allow", Action: ["s3:PutObject"], Resource: `${arn}/*` }],
			}),
		);
	}

	readPolicies(name: string): LambdaPolicy[] {
		return [{ name: `${name}-read-pol`, policy: this.readPolicyDocument }];
	}

	writePolicies(name: string): LambdaPolicy[] {
		return [{ name: `${name}-write-pol`, policy: this.writePolicyDocument }];
	}
}
