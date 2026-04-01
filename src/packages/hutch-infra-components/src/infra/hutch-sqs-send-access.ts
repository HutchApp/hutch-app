import * as pulumi from "@pulumi/pulumi";
import type { LambdaPolicy } from "./hutch-lambda";

export class HutchSqsSendAccess {
	public readonly policies: LambdaPolicy[];

	constructor(name: string, args: { queueArn: pulumi.Input<string> }) {
		this.policies = [
			{
				name: `${name}-pol`,
				policy: pulumi.output(args.queueArn).apply((arn) =>
					JSON.stringify({
						Version: "2012-10-17",
						Statement: [{
							Effect: "Allow",
							Action: ["sqs:SendMessage"],
							Resource: [arn],
						}],
					}),
				),
			},
		];
	}
}
