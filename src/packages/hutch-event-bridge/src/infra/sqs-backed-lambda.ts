import * as aws from "@pulumi/aws";
import type { HutchLambda } from "./hutch-lambda";
import { HutchSqsQueue } from "./sqs-queue";

export class SQSBackedLambda {
	public readonly queueArn: HutchSqsQueue["queueArn"];
	public readonly queueUrl: HutchSqsQueue["queueUrl"];
	public readonly dlqUrl: HutchSqsQueue["dlqUrl"];

	constructor(
		name: string,
		args: {
			lambda: HutchLambda;
			visibilityTimeoutSeconds: number;
			batchSize: number;
		},
	) {
		const queue = new HutchSqsQueue(name, {
			visibilityTimeoutSeconds: args.visibilityTimeoutSeconds,
		});

		new aws.iam.RolePolicy(`${name}-sqs-receive`, {
			role: args.lambda.role.name,
			policy: queue.queueArn.apply((arn) =>
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
			eventSourceArn: queue.queueArn,
			functionName: args.lambda.arn,
			batchSize: args.batchSize,
		});

		this.queueArn = queue.queueArn;
		this.queueUrl = queue.queueUrl;
		this.dlqUrl = queue.dlqUrl;
	}
}
