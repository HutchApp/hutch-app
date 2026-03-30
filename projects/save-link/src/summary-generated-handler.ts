import { EventListener, events } from "@packages/hutch-event-bridge";

const listener = new EventListener(events.SUMMARY_GENERATED, async (detail) => {
	console.log("[summary-generated-handler] received SummaryGenerated event", JSON.stringify(detail));
	console.log("[summary-generated-handler] summary generation attempt logged (no actual persistence)");
});

export const handler = listener.handler;
