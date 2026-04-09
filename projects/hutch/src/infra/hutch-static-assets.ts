import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { HutchCertificate, HutchS3PublicRead } from "@packages/hutch-infra-components/infra";

export class HutchStaticAssets extends pulumi.ComponentResource {
	public readonly baseUrl: pulumi.Output<string>;

	constructor(
		name: string,
		args: {
			bucketName: string;
			staticDomains: string[];
			domains: string[];
			zoneId?: Promise<string>;
		},
		opts?: pulumi.ComponentResourceOptions,
	) {
		super("hutch:infra:HutchStaticAssets", name, {}, opts);

		const publicBucket = new HutchS3PublicRead(name, {
			bucketName: args.bucketName,
			bucketOpts: { aliases: [{ name: `${name}-bucket`, parent: pulumi.rootStackResource }] },
		}, { parent: this });

		let viewerCertificate: aws.types.input.cloudfront.DistributionViewerCertificate;
		let aliases: pulumi.Input<string>[] | undefined;

		if (args.zoneId) {
			const zoneId = args.zoneId;
			const usEast1 = new aws.Provider(`${name}-us-east-1`, {
				region: "us-east-1",
			}, { parent: this, aliases: [{ parent: pulumi.rootStackResource }] });

			const [primaryDomain, ...altDomains] = args.staticDomains;

			const cert = new HutchCertificate(name, {
				primaryDomain,
				altDomains,
				zoneId,
				provider: usEast1,
			}, { parent: this });

			aliases = args.staticDomains;
			viewerCertificate = {
				acmCertificateArn: cert.certificateArn,
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
			{ parent: this, aliases: [{ parent: pulumi.rootStackResource }] },
		);

		const distribution = new aws.cloudfront.Distribution(
			`${name}-cdn`,
			{
				enabled: true,
				aliases,
				origins: [
					{
						originId: "s3",
						domainName: publicBucket.bucketRegionalDomainName,
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
			{ parent: this, aliases: [{ parent: pulumi.rootStackResource }] },
		);

		if (args.zoneId) {
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
				}, { parent: this, aliases: [{ parent: pulumi.rootStackResource }] });
			}
		}

		this.baseUrl = pulumi.output(`https://${args.staticDomains[0]}`);
		this.registerOutputs();
	}
}
