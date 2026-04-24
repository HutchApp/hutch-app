/* c8 ignore start -- thin SDK wrapper, only used in prod path */
import type { PublishEvent } from "@packages/hutch-infra-components/runtime";
import { SaveLinkRawHtmlCommand } from "@packages/hutch-infra-components";
import type { PublishSaveLinkRawHtmlCommand } from "./publish-save-link-raw-html-command.types";

export function initEventBridgeSaveLinkRawHtmlCommand(deps: {
	publishEvent: PublishEvent;
}): { publishSaveLinkRawHtmlCommand: PublishSaveLinkRawHtmlCommand } {
	const { publishEvent } = deps;

	const publishSaveLinkRawHtmlCommand: PublishSaveLinkRawHtmlCommand = async (params) => {
		await publishEvent({
			source: SaveLinkRawHtmlCommand.source,
			detailType: SaveLinkRawHtmlCommand.detailType,
			detail: JSON.stringify({
				url: params.url,
				userId: params.userId,
				title: params.title,
			}),
		});
	};

	return { publishSaveLinkRawHtmlCommand };
}
/* c8 ignore stop */
