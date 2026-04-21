import { HutchLogger } from "@packages/hutch-logger";
import type { ParseErrorEvent } from "@packages/hutch-infra-components";
import { initSummaryGenerationFailedHandler } from "../generate-summary/summary-generation-failed-handler";

export const handler = initSummaryGenerationFailedHandler({
	logger: HutchLogger.fromJSON<ParseErrorEvent>(),
	now: () => new Date(),
});
