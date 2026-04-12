import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import assert from "node:assert";
import { HutchCertificate, HutchS3PublicRead } from "@packages/hutch-infra-components/infra";

export interface StaticDomainEntry {
	domain: string;
	zoneId?: pulumi.Input<string>;
}

/**
 * Resource-naming convention:
 *   staticDomains[0]     — legacy primary; keeps the original Pulumi names
 *                          (`${name}`, `${name}-cdn`) so existing deployments see a no-op.
 *   staticDomains[1..]   — additional canonicals; each gets its own cert, CloudFront
 *                          distribution, and Route53 record with suffixed names.
 */
export class HutchStaticAssets extends pulumi.ComponentResource {
	public readonly baseUrl: pulumi.Output<string>;

	constructor(
		name: string,
		args: {
			bucketName: string;
			staticDomains: StaticDomainEntry[];
			domains: string[];
		},
		opts?: pulumi.ComponentResourceOptions,
	) {
		super("hutch:infra:HutchStaticAssets", name, {}, opts);

		assert(args.staticDomains.length > 0, "staticDomains must have at least one entry");

		const publicBucket = new HutchS3PublicRead(name, {
			bucketName: args.bucketName,
			bucketOpts: { aliases: [{ name: `${name}-bucket`, parent: pulumi.rootStackResource }] },
		}, { parent: this });

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

		const hasAnyZone = args.staticDomains.some((sd) => sd.zoneId !== undefined);
		const usEast1 = hasAnyZone
			? new aws.Provider(
					`${name}-us-east-1`,
					{ region: "us-east-1" },
					{ parent: this, aliases: [{ parent: pulumi.rootStackResource }] },
				)
			: undefined;

		for (const [i, entry] of args.staticDomains.entries()) {
			const safeName = entry.domain.replace(/\./g, "-");
			const nameSuffix = i === 0 ? "" : `-${safeName}`;

			let viewerCertificate: aws.types.input.cloudfront.DistributionViewerCertificate;
			let distributionAliases: pulumi.Input<string>[] | undefined;

			if (entry.zoneId && usEast1) {
				const cert = new HutchCertificate(
					`${name}${nameSuffix}`,
					{
						primaryDomain: entry.domain,
						altDomains: [],
						zoneId: entry.zoneId,
						provider: usEast1,
					},
					{ parent: this },
				);
				viewerCertificate = {
					acmCertificateArn: cert.certificateArn,
					sslSupportMethod: "sni-only",
					minimumProtocolVersion: "TLSv1.2_2021",
				};
				distributionAliases = [entry.domain];
			} else {
				viewerCertificate = { cloudfrontDefaultCertificate: true };
			}

			const distribution = new aws.cloudfront.Distribution(
				`${name}-cdn${nameSuffix}`,
				{
					enabled: true,
					aliases: distributionAliases,
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
				{
					parent: this,
					aliases: i === 0 ? [{ parent: pulumi.rootStackResource }] : undefined,
				},
			);

			if (entry.zoneId) {
				new aws.route53.Record(
					`${name}-record-${safeName}`,
					{
						zoneId: entry.zoneId,
						name: entry.domain,
						type: "A",
						aliases: [
							{
								name: distribution.domainName,
								zoneId: distribution.hostedZoneId,
								evaluateTargetHealth: false,
							},
						],
					},
					{ parent: this, aliases: [{ parent: pulumi.rootStackResource }] },
				);
			}
		}

		this.baseUrl = pulumi.output(`https://${args.staticDomains[0].domain}`);
		this.registerOutputs();
	}
}
