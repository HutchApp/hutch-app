import type { HutchLogger } from "@packages/hutch-logger";
import type { PublishSaveLinkRawHtmlCommand } from "./publish-save-link-raw-html-command.types";

export function initInMemorySaveLinkRawHtmlCommand(deps: {
	logger: HutchLogger;
}): { publishSaveLinkRawHtmlCommand: PublishSaveLinkRawHtmlCommand } {
	const { logger } = deps;

	const publishSaveLinkRawHtmlCommand: PublishSaveLinkRawHtmlCommand = async (params) => {
		logger.info("[SaveLinkRawHtmlCommand] event published (in-memory no-op)", {
			url: params.url,
			userId: params.userId,
		});
	};

	return { publishSaveLinkRawHtmlCommand };
}
