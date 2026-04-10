/* c8 ignore start -- thin SDK wrapper, only used in prod path */
import type { PublishEvent } from "@packages/hutch-infra-components/runtime";
import { UpdateFetchTimestampCommand } from "@packages/hutch-infra-components";
import type { PublishUpdateFetchTimestamp } from "./publish-update-fetch-timestamp.types";

export function initEventBridgeUpdateFetchTimestamp(deps: {
	publishEvent: PublishEvent;
}): { publishUpdateFetchTimestamp: PublishUpdateFetchTimestamp } {
	const { publishEvent } = deps;

	const publishUpdateFetchTimestamp: PublishUpdateFetchTimestamp = async (params) => {
		await publishEvent({
			source: UpdateFetchTimestampCommand.source,
			detailType: UpdateFetchTimestampCommand.detailType,
			detail: JSON.stringify({
				url: params.url,
				contentFetchedAt: params.contentFetchedAt,
			}),
		});
	};

	return { publishUpdateFetchTimestamp };
}
/* c8 ignore stop */
