import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import {
	PARSE_ERROR_STREAM,
	type ParseErrorEvent,
} from "@packages/hutch-infra-components";
import { SummaryGenerationFailedEvent } from "./index";

export function initSummaryGenerationFailedHandler(deps: {
	logger: HutchLogger.Typed<ParseErrorEvent>;
	now: () => Date;
}): SQSHandler {
	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = SummaryGenerationFailedEvent.detailSchema.parse(envelope.detail);

			deps.logger.info({
				stream: PARSE_ERROR_STREAM,
				event: "parse-failure",
				timestamp: deps.now().toISOString(),
				url: detail.url,
				reason: `summary-generation-failed: ${detail.reason} (receiveCount=${detail.receiveCount})`,
				source: "generate-summary",
			});
		}
	};
}
