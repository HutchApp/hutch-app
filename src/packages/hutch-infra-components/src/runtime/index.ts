import assert from "node:assert";
import {
	EventBridgeClient,
	PutEventsCommand,
} from "@aws-sdk/client-eventbridge";

export {
	initSqsCommandDispatcher,
	type DispatchCommand,
} from "./sqs-command-dispatcher";

export type PublishEvent = (params: {
	source: string;
	detailType: string;
	detail: string;
}) => Promise<void>;

export function initEventBridgePublisher(deps: {
	client: EventBridgeClient;
	eventBusName: string;
}): { publishEvent: PublishEvent } {
	const { client, eventBusName } = deps;

	const publishEvent: PublishEvent = async (params) => {
		const result = await client.send(
			new PutEventsCommand({
				Entries: [
					{
						Source: params.source,
						DetailType: params.detailType,
						Detail: params.detail,
						EventBusName: eventBusName,
					},
				],
			}),
		);
		assert(
			result.FailedEntryCount === 0,
			`EventBridge PutEvents failed: ${JSON.stringify(result.Entries)}`,
		);
	};

	return { publishEvent };
}

export { EventBridgeClient };
