import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export class DomainRegistration {
	public readonly certificateArn?: pulumi.Output<string>;
	public readonly zoneId?: Promise<string>;
	public readonly domains: string[];
	public readonly primaryDomain?: string;

	constructor(name: string, args: { domains: string[] }) {
		this.domains = args.domains;

		if (args.domains.length === 0) return;

		const [primaryDomain, ...altDomains] = args.domains;
		this.primaryDomain = primaryDomain;

		const zone = aws.route53.getZone({ name: primaryDomain });
		const zoneId = zone.then((z) => z.zoneId);
		this.zoneId = zoneId;

		const cert = new aws.acm.Certificate(`${name}-cert`, {
			domainName: primaryDomain,
			subjectAlternativeNames:
				altDomains.length > 0 ? altDomains : undefined,
			validationMethod: "DNS",
		});

		const validationRecords = cert.domainValidationOptions.apply((opts) =>
			opts.map(
				(opt, i) =>
					new aws.route53.Record(`${name}-cert-validation-${i}`, {
						zoneId,
						name: opt.resourceRecordName,
						type: opt.resourceRecordType,
						records: [opt.resourceRecordValue],
						ttl: 300,
					}),
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
		);

		this.certificateArn = validated.certificateArn;
	}
}
