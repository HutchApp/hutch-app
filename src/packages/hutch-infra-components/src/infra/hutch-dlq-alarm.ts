import type * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export class HutchDlqAlarm {
	constructor(
		name: string,
		args: {
			queues: { name: string; dlqName: pulumi.Input<string> }[];
			alertEmail: string;
		},
	) {
		const topic = new aws.sns.Topic(`${name}-dlq-alarm-topic`);

		new aws.sns.TopicSubscription(`${name}-dlq-alarm-email`, {
			topic: topic.arn,
			protocol: "email",
			endpoint: args.alertEmail,
		});

		for (const queue of args.queues) {
			new aws.cloudwatch.MetricAlarm(`${name}-${queue.name}-dlq-alarm`, {
				comparisonOperator: "GreaterThanOrEqualToThreshold",
				evaluationPeriods: 1,
				metricName: "ApproximateNumberOfMessagesVisible",
				namespace: "AWS/SQS",
				period: 300,
				statistic: "Sum",
				threshold: 1,
				alarmDescription: `Message entered ${name}-${queue.name} dead letter queue`,
				dimensions: {
					QueueName: queue.dlqName,
				},
				alarmActions: [topic.arn],
			});
		}
	}
}
