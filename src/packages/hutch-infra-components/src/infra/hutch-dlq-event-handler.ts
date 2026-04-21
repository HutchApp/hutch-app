import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { HutchEventBus } from "./event-bus";
import { HutchDynamoDBAccess } from "./hutch-dynamodb-access";
import { HutchLambda } from "./hutch-lambda";
import type { HutchSQS } from "./hutch-sqs";

/**
 * Attaches a Lambda to the DLQ of an existing `HutchSQS` so dead-lettered
 * messages drive a state transition on the articles table and publish a
 * domain failure event. All configuration is fixed — callers get the current
 * convention (256MB memory, 30s timeout, batchSize 1, dynamodb:UpdateItem
 * only, DYNAMODB_ARTICLES_TABLE + EVENT_BUS_NAME env vars, entry point
 * derived from the component name). New knobs are added here only when a
 * real second caller demands them.
 */
export class HutchDLQEventHandler extends pulumi.ComponentResource {
	constructor(
		name: string,
		args: {
			sourceQueue: HutchSQS;
			tableArn: pulumi.Input<string>;
			tableName: pulumi.Input<string>;
			eventBus: HutchEventBus;
		},
		opts?: pulumi.ComponentResourceOptions,
	) {
		super("hutch:infra:HutchDLQEventHandler", name, {}, opts);

		const dynamodb = new HutchDynamoDBAccess(`${name}-dynamodb`, {
			tables: [{ arn: args.tableArn, includeIndexes: false }],
			actions: ["dynamodb:UpdateItem"],
		});

		const lambda = new HutchLambda(name, {
			entryPoint: `./src/runtime/${name}.main.ts`,
			outputDir: `.lib/${name}`,
			assetDir: "./src",
			memorySize: 256,
			timeout: 30,
			environment: {
				DYNAMODB_ARTICLES_TABLE: args.tableName,
				EVENT_BUS_NAME: args.eventBus.eventBusName,
			},
			policies: [...dynamodb.policies],
		}, { parent: this });

		args.eventBus.grantPublish(lambda);

		new aws.iam.RolePolicy(`${name}-sqs-recv`, {
			name: `${name}-sqs-recv`,
			role: lambda.role.name,
			policy: args.sourceQueue.dlqArn.apply((arn) =>
				JSON.stringify({
					Version: "2012-10-17",
					Statement: [{
						Effect: "Allow",
						Action: ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
						Resource: [arn],
					}],
				}),
			),
		}, { parent: this });

		new aws.lambda.EventSourceMapping(`${name}-mapping`, {
			eventSourceArn: args.sourceQueue.dlqArn,
			functionName: lambda.arn,
			batchSize: 1,
		}, { parent: this });

		this.registerOutputs();
	}
}
