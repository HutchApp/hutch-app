import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import type { HutchS3ReadWrite } from "./hutch-s3-read-write";

export class HutchS3ContentMediaCDN extends pulumi.ComponentResource {
	public readonly baseUrl: pulumi.Output<string>;

	constructor(
		name: string,
		args: {
			contentBucket: HutchS3ReadWrite;
		},
		opts?: pulumi.ComponentResourceOptions,
	) {
		super("hutch:infra:HutchS3ContentMediaCDN", name, {}, opts);

		const logsBucket = new aws.s3.Bucket(`${name}-cdn-logs`, {
			forceDestroy: true,
		}, { parent: this });

		new aws.s3.BucketOwnershipControls(`${name}-cdn-logs-ownership`, {
			bucket: logsBucket.id,
			rule: { objectOwnership: "BucketOwnerPreferred" },
		}, { parent: this });

		const oac = new aws.cloudfront.OriginAccessControl(`${name}-oac`, {
			name: `${name}-oac`,
			originAccessControlOriginType: "s3",
			signingBehavior: "always",
			signingProtocol: "sigv4",
		}, { parent: this });

		const distribution = new aws.cloudfront.Distribution(`${name}-cdn`, {
			enabled: true,
			origins: [{
				originId: "content-s3",
				domainName: args.contentBucket.bucketRegionalDomainName,
				originAccessControlId: oac.id,
			}],
			defaultCacheBehavior: {
				targetOriginId: "content-s3",
				viewerProtocolPolicy: "redirect-to-https",
				allowedMethods: ["GET", "HEAD"],
				cachedMethods: ["GET", "HEAD"],
				cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
			},
			restrictions: {
				geoRestriction: { restrictionType: "none" },
			},
			viewerCertificate: {
				cloudfrontDefaultCertificate: true,
			},
			priceClass: "PriceClass_100",
			loggingConfig: {
				bucket: logsBucket.bucketDomainName,
				prefix: `${name}/`,
			},
		}, { parent: this });

		new aws.s3.BucketPolicy(`${name}-bucket-access`, {
			bucket: args.contentBucket.bucket,
			policy: pulumi.all([args.contentBucket.arn, distribution.arn]).apply(([bucketArn, distArn]) =>
				JSON.stringify({
					Version: "2012-10-17",
					Statement: [{
						Effect: "Allow",
						Principal: { Service: "cloudfront.amazonaws.com" },
						Action: "s3:GetObject",
						Resource: `${bucketArn}/*`,
						Condition: { StringEquals: { "AWS:SourceArn": distArn } },
					}],
				}),
			),
		}, { parent: this });

		this.baseUrl = pulumi.interpolate`https://${distribution.domainName}`;
		this.registerOutputs();
	}
}
