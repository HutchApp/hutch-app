import { type EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import type { z } from "zod";

interface EventDefinition<T extends z.ZodType> {
	source: string;
	detailType: string;
	schema: T;
}

export type PublishEvent<T extends z.ZodType> = (detail: z.infer<T>) => Promise<void>;

export function initEventPublisher<T extends z.ZodType>(deps: {
	client: EventBridgeClient;
	eventBusName: string;
	event: EventDefinition<T>;
}): PublishEvent<T> {
	return async (detail) => {
		await deps.client.send(
			new PutEventsCommand({
				Entries: [
					{
						EventBusName: deps.eventBusName,
						Source: deps.event.source,
						DetailType: deps.event.detailType,
						Detail: JSON.stringify(detail),
					},
				],
			}),
		);
	};
}
