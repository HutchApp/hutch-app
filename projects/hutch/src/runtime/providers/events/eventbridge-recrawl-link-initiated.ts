/* c8 ignore start -- thin SDK wrapper, only used in prod path */
import type { PublishEvent } from "@packages/hutch-infra-components/runtime";
import { RecrawlLinkInitiatedEvent } from "@packages/hutch-infra-components";
import type { PublishRecrawlLinkInitiated } from "./publish-recrawl-link-initiated.types";

export function initEventBridgeRecrawlLinkInitiated(deps: {
	publishEvent: PublishEvent;
}): { publishRecrawlLinkInitiated: PublishRecrawlLinkInitiated } {
	const { publishEvent } = deps;

	const publishRecrawlLinkInitiated: PublishRecrawlLinkInitiated = async (params) => {
		await publishEvent({
			source: RecrawlLinkInitiatedEvent.source,
			detailType: RecrawlLinkInitiatedEvent.detailType,
			detail: JSON.stringify({ url: params.url }),
		});
	};

	return { publishRecrawlLinkInitiated };
}
/* c8 ignore stop */
