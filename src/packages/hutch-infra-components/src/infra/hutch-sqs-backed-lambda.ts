import * as aws from "@pulumi/aws";
import type { HutchLambda } from "./hutch-lambda";
import type { HutchSQS } from "./hutch-sqs";

export class HutchSQSBackedLambda {
	constructor(
		name: string,
		args: {
			lambda: HutchLambda;
			queue: HutchSQS;
			alertEmailDLQEntry: string;
		},
	) {
		new aws.iam.RolePolicy(`${name}-sqs-recv`, {
			name: `${name}-sqs-recv`,
			role: args.lambda.role.name,
			policy: args.queue.queueArn.apply((arn) =>
				JSON.stringify({
					Version: "2012-10-17",
					Statement: [{
						Effect: "Allow",
						Action: ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
						Resource: [arn],
					}],
				}),
			),
		});

		new aws.lambda.EventSourceMapping(`${name}-sqs-mapping`, {
			eventSourceArn: args.queue.queueArn,
			functionName: args.lambda.arn,
			batchSize: 1,
		});

		const topic = new aws.sns.Topic(`${name}-dlq-topic`, {
			name: `${name}-dlq-topic`,
		});

		new aws.sns.TopicSubscription(`${name}-dlq-alarm-email`, {
			topic: topic.arn,
			protocol: "email",
			endpoint: args.alertEmailDLQEntry,
		});

		new aws.cloudwatch.MetricAlarm(`${name}-dlq-alarm`, {
			name: `${name}-dlq-alarm`,
			comparisonOperator: "GreaterThanOrEqualToThreshold",
			evaluationPeriods: 1,
			metricName: "ApproximateNumberOfMessagesVisible",
			namespace: "AWS/SQS",
			period: 300,
			statistic: "Sum",
			threshold: 1,
			alarmDescription: `Message entered ${name} dead letter queue`,
			dimensions: {
				QueueName: args.queue.dlqName,
			},
			alarmActions: [topic.arn],
		});
	}
}
