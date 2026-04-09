import * as aws from "@pulumi/aws";
import { HutchCertificate } from "@packages/hutch-infra-components/infra";

export class DomainRedirect {
	constructor(name: string, args: { redirectDomains: string[]; targetDomain: string }) {
		if (args.redirectDomains.length === 0) return;

		const usEast1 = new aws.Provider(`${name}-us-east-1`, {
			region: "us-east-1",
		});

		for (const domain of args.redirectDomains) {
			const safeName = domain.replace(/\./g, "-");
			const resourcePrefix = `${name}-${safeName}`;

			const zone = aws.route53.getZone({ name: domain });
			const zoneId = zone.then((z) => z.zoneId);

			const cert = new HutchCertificate(resourcePrefix, {
				primaryDomain: domain,
				altDomains: [],
				zoneId,
				provider: usEast1,
			});

			const bucket = new aws.s3.BucketV2(`${resourcePrefix}-bucket`, {
				bucket: domain,
			});

			const websiteConfig = new aws.s3.BucketWebsiteConfigurationV2(
				`${resourcePrefix}-website`,
				{
					bucket: bucket.id,
					redirectAllRequestsTo: {
						hostName: args.targetDomain,
						protocol: "https",
					},
				},
			);

			const distribution = new aws.cloudfront.Distribution(
				`${resourcePrefix}-cdn`,
				{
					enabled: true,
					aliases: [domain],
					origins: [
						{
							originId: "s3-website",
							domainName: websiteConfig.websiteEndpoint,
							customOriginConfig: {
								httpPort: 80,
								httpsPort: 443,
								originProtocolPolicy: "http-only",
								originSslProtocols: ["TLSv1.2"],
							},
						},
					],
					defaultCacheBehavior: {
						targetOriginId: "s3-website",
						viewerProtocolPolicy: "redirect-to-https",
						allowedMethods: ["GET", "HEAD"],
						cachedMethods: ["GET", "HEAD"],
						compress: true,
						cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
					},
					restrictions: {
						geoRestriction: {
							restrictionType: "none",
						},
					},
					viewerCertificate: {
						acmCertificateArn: cert.certificateArn,
						sslSupportMethod: "sni-only",
						minimumProtocolVersion: "TLSv1.2_2021",
					},
					priceClass: "PriceClass_100",
				},
			);

			new aws.route53.Record(`${resourcePrefix}-record`, {
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
	}
}
