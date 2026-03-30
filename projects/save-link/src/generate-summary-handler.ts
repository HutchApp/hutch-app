import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { initEventPublisher, events } from "@packages/hutch-event-bridge";
import type { SQSHandler } from "aws-lambda";
import { requireEnv } from "./require-env";

const eventBusName = requireEnv("EVENT_BUS_NAME");
const client = new EventBridgeClient({});

const publishSummaryGenerated = initEventPublisher({
	client,
	eventBusName,
	event: events.SUMMARY_GENERATED,
});

export const handler: SQSHandler = async (sqsEvent) => {
	for (const record of sqsEvent.Records) {
		const message = JSON.parse(record.body);
		console.log("[generate-summary-handler] received message", JSON.stringify(message));

		console.log("[generate-summary-handler] publishing SummaryGenerated with mocked data");
		await publishSummaryGenerated({
			url: message.url,
			summary: "[mocked] This is a placeholder summary for infrastructure testing.",
			inputTokens: 0,
			outputTokens: 0,
		});

		console.log("[generate-summary-handler] done");
	}
};
