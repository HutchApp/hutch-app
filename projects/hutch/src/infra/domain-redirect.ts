import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import assert from "node:assert";

export class DomainRedirect {
	constructor(name: string, args: { domains: string[]; target: string }) {
		if (args.domains.length === 0) return;

		assert(args.target, "target is required when redirect domains are provided");

		const usEast1 = new aws.Provider(`${name}-us-east-1`, {
			region: "us-east-1",
		});

		const domainZones = args.domains.map((domain) => ({
			domain,
			zoneId: aws.route53.getZone({ name: domain }).then((z) => z.zoneId),
		}));

		const [primaryDomain, ...altDomains] = args.domains;

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

		const validationRecords = cert.domainValidationOptions.apply((opts) =>
			opts.map((opt, i) => {
				const matchingZone = domainZones.find(
					(dz) => dz.domain === opt.domainName,
				);
				assert(
					matchingZone,
					`No hosted zone found for domain ${opt.domainName}`,
				);
				return new aws.route53.Record(`${name}-cert-val-${i}`, {
					zoneId: matchingZone.zoneId,
					name: opt.resourceRecordName,
					type: opt.resourceRecordType,
					records: [opt.resourceRecordValue],
					ttl: 300,
				});
			}),
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

		const redirectFn = new aws.cloudfront.Function(`${name}-fn`, {
			name: `${name}-redirect`,
			runtime: "cloudfront-js-2.0",
			code: `function handler(event) {
  return {
    statusCode: 301,
    statusDescription: "Moved Permanently",
    headers: {
      location: { value: "https://${args.target}" + event.request.uri }
    }
  };
}`,
		});

		const distribution = new aws.cloudfront.Distribution(`${name}-cdn`, {
			enabled: true,
			aliases: args.domains,
			origins: [
				{
					originId: "redirect",
					domainName: args.target,
					customOriginConfig: {
						httpPort: 80,
						httpsPort: 443,
						originProtocolPolicy: "https-only",
						originSslProtocols: ["TLSv1.2"],
					},
				},
			],
			defaultCacheBehavior: {
				targetOriginId: "redirect",
				viewerProtocolPolicy: "redirect-to-https",
				allowedMethods: ["GET", "HEAD"],
				cachedMethods: ["GET", "HEAD"],
				cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
				functionAssociations: [
					{
						eventType: "viewer-request",
						functionArn: redirectFn.arn,
					},
				],
			},
			restrictions: {
				geoRestriction: { restrictionType: "none" },
			},
			viewerCertificate: {
				acmCertificateArn: validated.certificateArn,
				sslSupportMethod: "sni-only",
				minimumProtocolVersion: "TLSv1.2_2021",
			},
			priceClass: "PriceClass_100",
		});

		for (const { domain, zoneId } of domainZones) {
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
	}
}
