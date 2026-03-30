import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export class HutchEventRule {
	public readonly rule: aws.cloudwatch.EventRule;

	constructor(
		name: string,
		args: {
			eventBusName: pulumi.Input<string>;
			source: string;
			detailType: string;
			targetQueueArn: pulumi.Input<string>;
			targetQueueUrl: pulumi.Input<string>;
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
			arn: args.targetQueueArn,
		});

		new aws.sqs.QueuePolicy(`${name}-queue-policy`, {
			queueUrl: args.targetQueueUrl,
			policy: pulumi
				.all([args.targetQueueArn, this.rule.arn])
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
