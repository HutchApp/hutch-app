import type { PublishEvent } from "@packages/hutch-infra-components/runtime";
import { LinkSavedEvent } from "@packages/hutch-infra-components";
import type { PublishLinkSaved } from "./publish-link-saved.types";

export function initEventBridgeLinkSaved(deps: {
	publishEvent: PublishEvent;
}): { publishLinkSaved: PublishLinkSaved } {
	const { publishEvent } = deps;

	const publishLinkSaved: PublishLinkSaved = async (params) => {
		await publishEvent({
			source: LinkSavedEvent.source,
			detailType: LinkSavedEvent.detailType,
			detail: JSON.stringify({
				url: params.url,
				userId: params.userId,
			}),
		});
	};

	return { publishLinkSaved };
}
