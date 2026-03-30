import * as aws from "@pulumi/aws";

export class HutchEventBus {
	public readonly eventBusName: aws.cloudwatch.EventBus["name"];
	public readonly eventBusArn: aws.cloudwatch.EventBus["arn"];

	constructor(name: string) {
		const bus = new aws.cloudwatch.EventBus(`${name}-event-bus`);
		this.eventBusName = bus.name;
		this.eventBusArn = bus.arn;
	}
}
