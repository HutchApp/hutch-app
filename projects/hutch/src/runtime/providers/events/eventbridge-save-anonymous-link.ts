/* c8 ignore start -- thin SDK wrapper, only used in prod path */
import type { PublishEvent } from "@packages/hutch-infra-components/runtime";
import { SaveAnonymousLinkCommand } from "@packages/hutch-infra-components";
import type { PublishSaveAnonymousLink } from "./publish-save-anonymous-link.types";

export function initEventBridgeSaveAnonymousLink(deps: {
	publishEvent: PublishEvent;
}): { publishSaveAnonymousLink: PublishSaveAnonymousLink } {
	const { publishEvent } = deps;

	const publishSaveAnonymousLink: PublishSaveAnonymousLink = async (params) => {
		await publishEvent({
			source: SaveAnonymousLinkCommand.source,
			detailType: SaveAnonymousLinkCommand.detailType,
			detail: JSON.stringify({ url: params.url }),
		});
	};

	return { publishSaveAnonymousLink };
}
/* c8 ignore stop */
