import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { HutchSQS } from "./hutch-sqs";

export class HutchEventRule {
	public readonly rule: aws.cloudwatch.EventRule;

	constructor(
		name: string,
		args: {
			eventBusName: pulumi.Input<string>;
			source: string;
			detailType: string;
			targetQueue: HutchSQS;
		},
	) {
		this.rule = new aws.cloudwatch.EventRule(`${name}-rule`, {
			eventBusName: args.eventBusName,
			eventPattern: JSON.stringify({
				source: [args.source],
				"detail-type": [args.detailType],
			}),
		});

		new aws.cloudwatch.EventTarget(`${name}-target`, {
			rule: this.rule.name,
			eventBusName: args.eventBusName,
			arn: args.targetQueue.queueArn,
		});

		new aws.sqs.QueuePolicy(`${name}-queue-policy`, {
			queueUrl: args.targetQueue.queueUrl,
			policy: pulumi
				.all([args.targetQueue.queueArn, this.rule.arn])
				.apply(([queueArn, ruleArn]) =>
					JSON.stringify({
						Version: "2012-10-17",
						Statement: [
							{
								Effect: "Allow",
								Principal: { Service: "events.amazonaws.com" },
								Action: "sqs:SendMessage",
								Resource: queueArn,
								Condition: {
									ArnEquals: { "aws:SourceArn": ruleArn },
								},
							},
						],
					}),
				),
		});
	}
}
