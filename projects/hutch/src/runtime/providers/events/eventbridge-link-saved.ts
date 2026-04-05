/* c8 ignore start -- thin SDK wrapper, only used in prod path */
import type { PublishEvent } from "@packages/hutch-infra-components/runtime";
import { SaveLinkCommand } from "@packages/hutch-infra-components";
import type { PublishLinkSaved } from "./publish-link-saved.types";

export function initEventBridgeLinkSaved(deps: {
	publishEvent: PublishEvent;
}): { publishLinkSaved: PublishLinkSaved } {
	const { publishEvent } = deps;

	const publishLinkSaved: PublishLinkSaved = async (params) => {
		await publishEvent({
			source: SaveLinkCommand.source,
			detailType: SaveLinkCommand.detailType,
			detail: JSON.stringify({
				url: params.url,
				userId: params.userId,
			}),
		});
	};

	return { publishLinkSaved };
}
/* c8 ignore stop */
