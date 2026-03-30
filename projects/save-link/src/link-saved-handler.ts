import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { EventListener, events } from "@packages/hutch-event-bridge";
import { requireEnv } from "./require-env";

const sqsClient = new SQSClient({});
const generateSummaryQueueUrl = requireEnv("GENERATE_SUMMARY_QUEUE_URL");

const listener = new EventListener(events.LINK_SAVED, async (detail) => {
	console.log("[link-saved-handler] received LinkSaved event", JSON.stringify(detail));

	await sqsClient.send(
		new SendMessageCommand({
			QueueUrl: generateSummaryQueueUrl,
			MessageBody: JSON.stringify({
				url: detail.url,
				userId: detail.userId,
			}),
		}),
	);

	console.log("[link-saved-handler] forwarded to generate-summary queue");
});

export const handler = listener.handler;
