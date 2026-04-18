import type { HutchLogger } from "@packages/hutch-logger";
import type { PublishSaveAnonymousLink } from "./publish-save-anonymous-link.types";

export function initInMemorySaveAnonymousLink(deps: {
	logger: HutchLogger;
}): { publishSaveAnonymousLink: PublishSaveAnonymousLink } {
	const { logger } = deps;

	const publishSaveAnonymousLink: PublishSaveAnonymousLink = async (params) => {
		logger.info("[SaveAnonymousLinkCommand] event published (in-memory no-op)", {
			url: params.url,
		});
	};

	return { publishSaveAnonymousLink };
}
