import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export class HutchEventBus {
	public readonly eventBusName: pulumi.Output<string>;
	public readonly eventBusArn: pulumi.Output<string>;

	constructor(
		name: string,
		args: { eventBusName: string },
	) {
		const eventBus = new aws.cloudwatch.EventBus(`${name}-bus`, {
			name: args.eventBusName,
		});

		this.eventBusName = eventBus.name;
		this.eventBusArn = eventBus.arn;
	}
}

export class HutchEventRule {
	public readonly rule: aws.cloudwatch.EventRule;

	constructor(
		name: string,
		args: {
			eventBusName: pulumi.Output<string>;
			ruleName: string;
			source: string;
			detailType: string;
			targetQueueArn: pulumi.Output<string>;
		},
	) {
		this.rule = new aws.cloudwatch.EventRule(`${name}-rule`, {
			name: args.ruleName,
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
			queueUrl: args.targetQueueArn.apply((arn) => {
				const parts = arn.split(":");
				const region = parts[3];
				const accountId = parts[4];
				const queueName = parts[5];
				return `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`;
			}),
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

export class HutchSqsQueue {
	public readonly queueArn: pulumi.Output<string>;
	public readonly queueUrl: pulumi.Output<string>;
	public readonly queueName: pulumi.Output<string>;
	public readonly dlqArn: pulumi.Output<string>;
	public readonly dlqUrl: pulumi.Output<string>;

	constructor(
		name: string,
		args: {
			queueName: string;
			visibilityTimeout: number;
			dlqMaxReceiveCount: number;
			dlqRetentionDays: number;
		},
	) {
		const dlq = new aws.sqs.Queue(`${name}-dlq`, {
			name: `${args.queueName}-DLQ`,
			messageRetentionSeconds: args.dlqRetentionDays * 86400,
		});

		const queue = new aws.sqs.Queue(`${name}-queue`, {
			name: args.queueName,
			visibilityTimeoutSeconds: args.visibilityTimeout,
			redrivePolicy: dlq.arn.apply((dlqArn) =>
				JSON.stringify({
					deadLetterTargetArn: dlqArn,
					maxReceiveCount: args.dlqMaxReceiveCount,
				}),
			),
		});

		this.queueArn = queue.arn;
		this.queueUrl = queue.url;
		this.queueName = queue.name;
		this.dlqArn = dlq.arn;
		this.dlqUrl = dlq.url;
	}
}
