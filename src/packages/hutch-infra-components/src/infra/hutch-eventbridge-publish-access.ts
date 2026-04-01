import * as pulumi from "@pulumi/pulumi";
import type { LambdaPolicy } from "./hutch-lambda";

export class HutchEventBridgePublishAccess {
	public readonly policies: LambdaPolicy[];

	constructor(name: string, args: { eventBusArn: pulumi.Input<string> }) {
		this.policies = [
			{
				name: `${name}-pol`,
				policy: pulumi.output(args.eventBusArn).apply((arn) =>
					JSON.stringify({
						Version: "2012-10-17",
						Statement: [{
							Effect: "Allow",
							Action: ["events:PutEvents"],
							Resource: [arn],
						}],
					}),
				),
			},
		];
	}
}
