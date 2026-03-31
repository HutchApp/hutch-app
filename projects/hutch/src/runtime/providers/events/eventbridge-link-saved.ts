import type { PublishEvent } from "@packages/hutch-event-bridge/runtime";
import {
	LINK_SAVED_SOURCE,
	LINK_SAVED_DETAIL_TYPE,
} from "save-link/save-link";
import type { PublishLinkSaved } from "./publish-link-saved.types";

export function initEventBridgeLinkSaved(deps: {
	publishEvent: PublishEvent;
}): { publishLinkSaved: PublishLinkSaved } {
	const { publishEvent } = deps;

	const publishLinkSaved: PublishLinkSaved = async (params) => {
		await publishEvent({
			source: LINK_SAVED_SOURCE,
			detailType: LINK_SAVED_DETAIL_TYPE,
			detail: JSON.stringify({
				url: params.url,
				userId: params.userId,
			}),
		});
	};

	return { publishLinkSaved };
}
