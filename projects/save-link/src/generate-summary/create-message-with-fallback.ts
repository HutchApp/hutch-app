import type { HutchLogger } from "@packages/hutch-logger";
import type { CreateAiMessage } from "./article-summary.types";

export function initCreateMessageWithFallback(deps: {
	primary: CreateAiMessage;
	fallback: CreateAiMessage;
	shouldFallback: (error: unknown) => boolean;
	logger: HutchLogger;
}): CreateAiMessage {
	return async (params) => {
		try {
			deps.logger.info("[summarize] primary AI starting");
			const result = await deps.primary(params);
			deps.logger.info("[summarize] primary AI completed");
			return result;
		} catch (error) {
			if (deps.shouldFallback(error)) {
				deps.logger.info("[summarize] primary AI error, falling back", error);
				deps.logger.info("[summarize] fallback AI starting");
				try {
					const result = await deps.fallback(params);
					deps.logger.info("[summarize] fallback AI completed");
					return result;
				} catch (fallbackError) {
					deps.logger.error("[summarize] fallback AI failed", fallbackError);
					throw fallbackError;
				}
			}
			throw error;
		}
	};
}
