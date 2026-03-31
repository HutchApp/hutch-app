import * as aws from "@pulumi/aws";

export class HutchEventBus {
	public readonly eventBusName: aws.cloudwatch.EventBus["name"];
	public readonly eventBusArn: aws.cloudwatch.EventBus["arn"];

	constructor(name: string, args?: { eventBusName?: string }) {
		const bus = new aws.cloudwatch.EventBus(`${name}-event-bus`, {
			name: args?.eventBusName,
		});
		this.eventBusName = bus.name;
		this.eventBusArn = bus.arn;
	}
}
