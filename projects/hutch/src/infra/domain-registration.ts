import type * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { HutchCertificate } from "@packages/hutch-infra-components/infra";

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

		const cert = new HutchCertificate(name, {
			primaryDomain,
			altDomains,
			zoneId,
		});

		this.certificateArn = cert.certificateArn;
	}
}
