import type { SQSHandler } from "aws-lambda";
import type { HutchLogger } from "@packages/hutch-logger";
import { UpdateFetchTimestampCommand } from "./index";

export type UpdateFetchTimestamp = (params: {
	url: string;
	contentFetchedAt: string;
	etag?: string;
	lastModified?: string;
}) => Promise<void>;

export function initUpdateFetchTimestampHandler(deps: {
	updateFetchTimestamp: UpdateFetchTimestamp;
	logger: HutchLogger;
}): SQSHandler {
	const { updateFetchTimestamp, logger } = deps;

	return async (event) => {
		for (const record of event.Records) {
			const envelope = JSON.parse(record.body);
			const detail = UpdateFetchTimestampCommand.detailSchema.parse(envelope.detail);

			logger.info("[UpdateFetchTimestamp] processing", { url: detail.url });

			await updateFetchTimestamp(detail);

			logger.info("[UpdateFetchTimestamp] completed", { url: detail.url });
		}
	};
}
