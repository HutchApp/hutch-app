import type { HutchLogger } from "@packages/hutch-logger";
import type { PublishUpdateFetchTimestamp } from "./publish-update-fetch-timestamp.types";

export function initInMemoryUpdateFetchTimestamp(deps: {
	logger: HutchLogger;
}): { publishUpdateFetchTimestamp: PublishUpdateFetchTimestamp } {
	const { logger } = deps;

	const publishUpdateFetchTimestamp: PublishUpdateFetchTimestamp = async (params) => {
		logger.info("[UpdateFetchTimestamp] event published (in-memory no-op)", {
			url: params.url,
		});
	};

	return { publishUpdateFetchTimestamp };
}
