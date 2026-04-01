import type { HutchLogger } from "@packages/hutch-logger";
import type { CreateAiMessage } from "./article-summary.types";

export function initCreateMessageWithFallback(deps: {
	primary: CreateAiMessage;
	fallback: CreateAiMessage;
	isQuotaError: (error: unknown) => boolean;
	logger: HutchLogger;
}): CreateAiMessage {
	return async (params) => {
		try {
			return await deps.primary(params);
		} catch (error) {
			if (deps.isQuotaError(error)) {
				deps.logger.info("[summarize] primary AI quota exceeded, falling back");
				return deps.fallback(params);
			}
			throw error;
		}
	};
}
