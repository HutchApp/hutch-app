import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export class HutchSqsQueue {
	public readonly queueArn: aws.sqs.Queue["arn"];
	public readonly queueUrl: aws.sqs.Queue["url"];
	public readonly queueName: aws.sqs.Queue["name"];
	public readonly dlqArn: aws.sqs.Queue["arn"];
	public readonly dlqUrl: aws.sqs.Queue["url"];

	constructor(
		name: string,
		args?: {
			visibilityTimeoutSeconds?: number;
			dlqMaxReceiveCount?: number;
			dlqRetentionSeconds?: number;
		},
	) {
		const visibilityTimeout = args?.visibilityTimeoutSeconds ?? 60;
		const maxReceiveCount = args?.dlqMaxReceiveCount ?? 3;
		const dlqRetention = args?.dlqRetentionSeconds ?? 1209600; // 14 days

		const dlq = new aws.sqs.Queue(`${name}-dlq`, {
			messageRetentionSeconds: dlqRetention,
		});

		const queue = new aws.sqs.Queue(`${name}-queue`, {
			visibilityTimeoutSeconds: visibilityTimeout,
			redrivePolicy: pulumi.jsonStringify({
				deadLetterTargetArn: dlq.arn,
				maxReceiveCount,
			}),
		});

		this.queueArn = queue.arn;
		this.queueUrl = queue.url;
		this.queueName = queue.name;
		this.dlqArn = dlq.arn;
		this.dlqUrl = dlq.url;
	}
}
