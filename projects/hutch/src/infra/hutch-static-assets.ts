import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import assert from "node:assert";

export class HutchStaticAssets {
	public readonly baseUrl: pulumi.Output<string>;

	constructor(
		name: string,
		args: {
			bucketName: string;
			staticDomains: string[];
			domains: string[];
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

		const corsOrigins =
			args.domains.length > 0
				? args.domains.map((d) => `https://${d}`)
				: ["*"];

		const responseHeadersPolicy = new aws.cloudfront.ResponseHeadersPolicy(
			`${name}-response-headers`,
			{
				name: `${name}-cors-headers`,
				corsConfig: {
					accessControlAllowCredentials: false,
					accessControlAllowHeaders: { items: ["*"] },
					accessControlAllowMethods: { items: ["GET", "HEAD"] },
					accessControlAllowOrigins: { items: corsOrigins },
					originOverride: true,
				},
			},
		);

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
					responseHeadersPolicyId: responseHeadersPolicy.id,
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
